import { Body, Controller, Delete, Get, Inject, Logger, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@german-job-engine/shared-types';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import { JwtPayload } from '../../../auth/application/dto/jwt-payload.interface';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailProviderPort } from '../../../email-provider/domain/ports/email-provider.port';
import { EMAIL_PROVIDERS } from '../../../provider-selection/domain/ports/email-provider-registry.token';
import { EmailProviderHealthRepository, EMAIL_PROVIDER_HEALTH_REPOSITORY } from '../../domain/ports/email-provider-health.repository';
import { EmailQueueRepository, EMAIL_QUEUE_REPOSITORY } from '../../domain/ports/email-queue.repository';
import { EmailMessageStatus } from '../../domain/models/email-message';
import { SenderIdentityRepository, SENDER_IDENTITY_REPOSITORY } from '../../domain/ports/sender-identity.repository';
import { DeliverabilityService } from '../../application/services/deliverability.service';
import { EmailTrackingService } from '../../application/services/email-tracking.service';
import { DomainReadinessService } from '../../application/services/domain-readiness.service';
import { SesDomainVerificationChecker } from '../../infrastructure/adapters/ses-domain-verification-checker';
import { SuppressEmailDto } from '../../application/dto/suppress-email.dto';
import { CreateSenderIdentityDto, RecordSenderVerificationDto, SenderIdentityActionDto } from '../../application/dto/admin-sender-identity.dto';
import { CandidateDocumentRepository, CANDIDATE_DOCUMENT_REPOSITORY } from '../../../documents/domain/ports/candidate-document.repository';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { EmailSecurityAuditEventType } from '../../../documents/domain/models/email-security-audit-event';

const CIRCUIT_BREAKER_FORCE_OPEN_MS = 24 * 60 * 60 * 1000; // 24h — an explicit admin action, not a guess

/**
 * M28 — Admin Operations: the real operational visibility and control surface this milestone's
 * own brief asks for (provider status, queue status, delivery/bounce/complaint statistics,
 * failure reasons, provider switching, retry monitoring). Admin-only, matching every other
 * admin-restricted endpoint in this codebase (`AdminBillingController`, M27) exactly —
 * `JwtAuthGuard` + `RolesGuard` + `@Roles(ADMIN)`, never a separate, weaker check.
 */
@ApiTags('admin-email')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/email')
export class AdminEmailController {
  private readonly logger = new Logger(AdminEmailController.name);

  constructor(
    @Inject(EMAIL_PROVIDERS) private readonly providers: EmailProviderPort[],
    @Inject(EMAIL_PROVIDER_HEALTH_REPOSITORY) private readonly health: EmailProviderHealthRepository,
    @Inject(EMAIL_QUEUE_REPOSITORY) private readonly queue: EmailQueueRepository,
    @Inject(SENDER_IDENTITY_REPOSITORY) private readonly senderIdentities: SenderIdentityRepository,
    @Inject(CANDIDATE_DOCUMENT_REPOSITORY) private readonly documents: CandidateDocumentRepository,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly deliverability: DeliverabilityService,
    private readonly tracking: EmailTrackingService,
    private readonly domainReadiness: DomainReadinessService,
    private readonly sesVerificationChecker: SesDomainVerificationChecker,
    private readonly securityAudit: EmailSecurityAuditService,
  ) {}

  @ApiOperation({ summary: 'Real per-provider capabilities, configuration status, and circuit-breaker health' })
  @Get('providers')
  async providerStatus() {
    const healthStates = await this.health.getAll();
    const healthByProviderId = new Map(healthStates.map((state) => [state.providerId, state]));

    return Promise.all(
      this.providers.map(async (provider) => {
        const capabilities = provider.getCapabilities();
        const available = await provider.isAvailable();
        const healthState = healthByProviderId.get(provider.providerId) ?? null;
        const now = this.clock.now();
        return {
          providerId: provider.providerId,
          configured: available,
          capabilities,
          circuitOpen: Boolean(healthState?.circuitOpenUntil && healthState.circuitOpenUntil > now),
          circuitOpenUntil: healthState?.circuitOpenUntil ?? null,
          consecutiveFailures: healthState?.consecutiveFailures ?? 0,
          lastSuccessAt: healthState?.lastSuccessAt ?? null,
          lastFailureAt: healthState?.lastFailureAt ?? null,
        };
      }),
    );
  }

  @ApiOperation({ summary: 'Manually force a provider off (circuit open) — real provider switching, logged with the acting admin id' })
  @Post('providers/:providerId/disable')
  async disableProvider(@Param('providerId') providerId: string, @CurrentUser() admin: JwtPayload): Promise<{ success: true }> {
    await this.health.forceOpen(providerId, this.clock.now(), CIRCUIT_BREAKER_FORCE_OPEN_MS);
    this.logger.warn(`Provider "${providerId}" manually disabled by admin ${admin.sub}.`);
    return { success: true };
  }

  @ApiOperation({ summary: 'Manually close a provider\'s circuit — resumes real eligibility for selection, logged with the acting admin id' })
  @Post('providers/:providerId/enable')
  async enableProvider(@Param('providerId') providerId: string, @CurrentUser() admin: JwtPayload): Promise<{ success: true }> {
    await this.health.forceClose(providerId);
    this.logger.log(`Provider "${providerId}" manually re-enabled by admin ${admin.sub}.`);
    return { success: true };
  }

  @ApiOperation({ summary: 'Real queue depth by status — QUEUED/SENDING/DEFERRED/DEAD_LETTER/etc.' })
  @Get('queue/stats')
  async queueStats() {
    return this.queue.countByStatus();
  }

  @ApiOperation({ summary: 'Real messages in a given status, most recent first — retry monitoring, dead-letter review' })
  @Get('queue/messages')
  async queueMessages(@Query('status') status: EmailMessageStatus, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.queue.listByStatus(status, limit ? Math.min(Number(limit), 200) : 50, offset ? Number(offset) : 0);
  }

  @ApiOperation({ summary: 'One message\'s full real event history — the immutable audit trail behind "track every email"' })
  @Get('messages/:id')
  async messageDetail(@Param('id') id: string) {
    const message = await this.queue.findById(id);
    if (!message) return null;
    const events = await this.tracking.history(id);
    return { message, events };
  }

  @ApiOperation({ summary: 'Real, computed-on-read deliverability/reputation snapshot over a trailing window' })
  @Get('deliverability/reputation')
  async reputation(@Query('windowDays') windowDays?: string) {
    return this.deliverability.getReputationSnapshot(windowDays ? Number(windowDays) : 30);
  }

  @ApiOperation({ summary: 'The real suppression list — hard bounces, complaints, and manual entries' })
  @Get('deliverability/suppressions')
  async suppressions(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    const [entries, total] = await Promise.all([
      this.deliverability.listSuppressions(limit ? Math.min(Number(limit), 200) : 50, offset ? Number(offset) : 0),
      this.deliverability.suppressionCount(),
    ]);
    return { entries, total };
  }

  @ApiOperation({ summary: 'Manually suppress an address — reason and acting admin are always recorded' })
  @Post('deliverability/suppressions')
  async addSuppression(@Body() dto: SuppressEmailDto, @CurrentUser() admin: JwtPayload) {
    return this.deliverability.suppressManually(dto.emailAddress, dto.note, admin.sub);
  }

  @ApiOperation({ summary: 'Remove an address from the suppression list — logged with the acting admin id' })
  @Delete('deliverability/suppressions/:emailAddress')
  async removeSuppression(@Param('emailAddress') emailAddress: string, @CurrentUser() admin: JwtPayload): Promise<{ success: true }> {
    await this.deliverability.unsuppress(emailAddress);
    this.logger.warn(`Suppression entry for "${emailAddress}" manually removed by admin ${admin.sub}.`);
    return { success: true };
  }

  // ---------- M28.5 — Sender Identity & Domain Readiness Admin Operations ----------

  @ApiOperation({ summary: 'Real domain readiness gate result — whether production delivery with attachments would currently pass' })
  @Get('domain-readiness')
  async checkDomainReadiness() {
    return this.domainReadiness.checkReadiness();
  }

  @ApiOperation({ summary: 'All registered sender identities and their real verification state' })
  @Get('sender-identities')
  async listSenderIdentities() {
    return this.senderIdentities.listAll();
  }

  @ApiOperation({ summary: 'Register a new sender identity (starts UNCONFIGURED) — logged with the acting admin id' })
  @Post('sender-identities')
  async createSenderIdentity(@Body() dto: CreateSenderIdentityDto, @CurrentUser() admin: JwtPayload) {
    const created = await this.senderIdentities.create(
      { displayName: dto.displayName, emailAddress: dto.emailAddress, domain: dto.domain, providerId: dto.providerId, replyToEmailAddress: dto.replyToEmailAddress ?? null },
      this.clock.now(),
    );
    this.logger.log(`Sender identity "${created.emailAddress}" (${created.providerId}) registered by admin ${admin.sub}.`);
    await this.securityAudit.record({ eventType: 'SENDER_IDENTITY_SELECTED', senderIdentityId: created.id, userId: admin.sub, detail: `Registered by admin ${admin.sub}.` });
    return created;
  }

  @ApiOperation({ summary: 'Retry provider-backed domain verification where a real check exists (SES today); other providers require the manual recording endpoint below' })
  @Post('sender-identities/:id/verify')
  async retrySenderVerification(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    const identity = await this.senderIdentities.findById(id);
    if (!identity) return null;

    if (identity.providerId !== 'ses') {
      return {
        checked: false,
        message: `No real automated verification check exists for provider "${identity.providerId}" yet — confirm domain verification via that provider's own dashboard, then record the result via PATCH /admin/email/sender-identities/${id}/verification.`,
      };
    }

    const result = await this.sesVerificationChecker.checkDomain(identity.domain);
    const updated = await this.senderIdentities.updateVerification(
      id,
      { verificationStatus: result.verified ? 'VERIFIED' : 'FAILED', dkimVerified: result.dkimVerified, failureReason: result.verified ? null : result.detail },
      this.clock.now(),
    );
    this.logger.log(`SES domain verification re-checked for "${identity.domain}" by admin ${admin.sub}: ${result.detail}`);
    await this.securityAudit.record({
      eventType: updated.verificationStatus === 'VERIFIED' ? 'DOMAIN_READINESS_PASSED' : 'SENDER_IDENTITY_REJECTED',
      senderIdentityId: id,
      userId: admin.sub,
      detail: result.detail,
    });
    return { checked: true, identity: updated };
  }

  @ApiOperation({ summary: 'Manually record a sender identity\'s verification/SPF/DKIM/DMARC state after confirming it via the provider\'s own dashboard — reason required, logged with the acting admin id' })
  @Patch('sender-identities/:id/verification')
  async recordSenderVerification(@Param('id') id: string, @Body() dto: RecordSenderVerificationDto, @CurrentUser() admin: JwtPayload) {
    const updated = await this.senderIdentities.updateVerification(
      id,
      { verificationStatus: dto.verificationStatus, dkimVerified: dto.dkimVerified, spfReady: dto.spfReady, dmarcReady: dto.dmarcReady, failureReason: dto.verificationStatus === 'VERIFIED' ? null : dto.reason },
      this.clock.now(),
    );
    this.logger.warn(`Sender identity "${id}" verification manually recorded as "${dto.verificationStatus}" by admin ${admin.sub}. Reason: ${dto.reason}`);
    await this.securityAudit.record({
      eventType: dto.verificationStatus === 'VERIFIED' ? 'DOMAIN_READINESS_PASSED' : 'SENDER_IDENTITY_REJECTED',
      senderIdentityId: id,
      userId: admin.sub,
      detail: dto.reason,
    });
    return updated;
  }

  @ApiOperation({ summary: 'Suspend a sender identity — reason required, logged with the acting admin id' })
  @Post('sender-identities/:id/suspend')
  async suspendSenderIdentity(@Param('id') id: string, @Body() dto: SenderIdentityActionDto, @CurrentUser() admin: JwtPayload): Promise<{ success: true }> {
    await this.senderIdentities.setActive(id, false);
    this.logger.warn(`Sender identity "${id}" suspended by admin ${admin.sub}. Reason: ${dto.reason}`);
    await this.securityAudit.record({ eventType: 'SENDER_IDENTITY_REJECTED', senderIdentityId: id, userId: admin.sub, detail: `Suspended: ${dto.reason}` });
    return { success: true };
  }

  @ApiOperation({ summary: 'Reactivate a suspended sender identity — reason required, logged with the acting admin id' })
  @Post('sender-identities/:id/activate')
  async activateSenderIdentity(@Param('id') id: string, @Body() dto: SenderIdentityActionDto, @CurrentUser() admin: JwtPayload): Promise<{ success: true }> {
    await this.senderIdentities.setActive(id, true);
    this.logger.log(`Sender identity "${id}" reactivated by admin ${admin.sub}. Reason: ${dto.reason}`);
    await this.securityAudit.record({ eventType: 'SENDER_IDENTITY_SELECTED', senderIdentityId: id, userId: admin.sub, detail: `Reactivated: ${dto.reason}` });
    return { success: true };
  }

  // ---------- M28.5 — Attachment Inspection Admin Operations ----------

  @ApiOperation({ summary: 'One document\'s real metadata and scan status — never its bytes or storage key' })
  @Get('documents/:id')
  async documentMetadata(@Param('id') id: string) {
    const document = await this.documents.findById(id);
    if (!document) return null;
    return {
      id: document.id,
      ownerUserId: document.ownerUserId,
      documentType: document.documentType,
      version: document.version,
      isActive: document.isActive,
      originalFileName: document.originalFileName,
      safeFileName: document.safeFileName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      checksumSha256: document.checksumSha256,
      scanStatus: document.scanStatus,
      scanFailureReason: document.scanFailureReason,
      scannedAt: document.scannedAt,
      scopeApplicationId: document.scopeApplicationId,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  @ApiOperation({ summary: 'The real attachment/sender/domain-readiness audit trail — filterable; "blocked attachment deliveries" = eventType=ATTACHMENT_REJECTED' })
  @Get('security-audit')
  async securityAuditLog(
    @Query('eventType') eventType?: EmailSecurityAuditEventType,
    @Query('documentId') documentId?: string,
    @Query('connectedMailboxId') connectedMailboxId?: string,
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.securityAudit.list(
      { eventType, documentId, connectedMailboxId, userId },
      limit ? Math.min(Number(limit), 200) : 50,
      offset ? Number(offset) : 0,
    );
  }
}
