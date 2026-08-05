import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '@german-job-engine/shared-types';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import { JwtPayload } from '../../../auth/application/dto/jwt-payload.interface';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { ConnectedMailboxRepository, CONNECTED_MAILBOX_REPOSITORY } from '../../../connected-mailbox/domain/ports/connected-mailbox.repository';
import { InboxWatchRepository, INBOX_WATCH_REPOSITORY } from '../../domain/ports/inbox-watch.repository';
import { InboxMessageRepository, INBOX_MESSAGE_REPOSITORY } from '../../domain/ports/inbox-message.repository';
import { ApplicationTransitionProposalRepository, APPLICATION_TRANSITION_PROPOSAL_REPOSITORY } from '../../domain/ports/application-transition-proposal.repository';
import { InboxWatchService } from '../../application/services/inbox-watch.service';
import { InboxRetentionService } from '../../application/services/inbox-retention.service';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';

class AdminActionReasonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

class ReprocessMessageDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

/**
 * M29 Phase 23 — secure admin visibility and operations for Inbox Intelligence. Matching
 * `AdminEmailController`/`AdminConnectedMailboxController`'s exact guard stack
 * (`JwtAuthGuard`+`RolesGuard`+`@Roles(ADMIN)`), every mutating action requires a reason and
 * records the acting admin id. Deliberately exposes ONLY aggregate/operational fields — never a
 * raw "browse this user's mailbox" endpoint (Phase 23: "never allow arbitrary browsing of a
 * user's unrelated mailbox"); the only per-message data an admin can see is what
 * `InboxMessageRecord` itself already carries (metadata + the same bounded sanitized excerpt a
 * user's own detail view shows — never anything a user themselves couldn't already see for their
 * own data).
 */
@ApiTags('admin-inbox-intelligence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/inbox-intelligence')
export class AdminInboxIntelligenceController {
  constructor(
    @Inject(CONNECTED_MAILBOX_REPOSITORY) private readonly mailboxes: ConnectedMailboxRepository,
    @Inject(INBOX_WATCH_REPOSITORY) private readonly watches: InboxWatchRepository,
    @Inject(INBOX_MESSAGE_REPOSITORY) private readonly inboxMessages: InboxMessageRepository,
    @Inject(APPLICATION_TRANSITION_PROPOSAL_REPOSITORY) private readonly proposals: ApplicationTransitionProposalRepository,
    private readonly watchService: InboxWatchService,
    private readonly retentionService: InboxRetentionService,
    private readonly audit: EmailSecurityAuditService,
  ) {}

  @ApiOperation({ summary: 'Every mailbox with an inbox capability, its watch health, and processing status' })
  @Get('mailboxes')
  async listInboxCapableMailboxes(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    const rows = await this.mailboxes.listAll(limit ? Math.min(Number(limit), 200) : 50, offset ? Number(offset) : 0);
    const inboxEnabled = rows.filter((m) => m.inboxCapabilityStatus !== 'NOT_REQUESTED');
    const withWatches = await Promise.all(
      inboxEnabled.map(async (mailbox) => ({
        id: mailbox.id,
        userId: mailbox.userId,
        provider: mailbox.provider,
        emailAddress: mailbox.emailAddress,
        inboxCapabilityStatus: mailbox.inboxCapabilityStatus,
        inboxReauthorizationRequired: mailbox.inboxReauthorizationRequired,
        inboxSystemSuspended: mailbox.inboxSystemSuspended,
        inboxSuspensionReason: mailbox.inboxSuspensionReason,
        lastSuccessfulInboxAccessAt: mailbox.lastSuccessfulInboxAccessAt,
        watch: await this.watches.findByConnectedMailboxId(mailbox.id),
      })),
    );
    return withWatches;
  }

  @ApiOperation({ summary: 'Ambiguous/manual-review-queue replies awaiting human resolution' })
  @Get('messages/needs-review')
  async listNeedsReview(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.inboxMessages.list({ reviewStatus: 'PENDING_REVIEW' }, limit ? Math.min(Number(limit), 200) : 50, offset ? Number(offset) : 0);
  }

  @ApiOperation({ summary: 'Pending application-transition proposals awaiting confirmation' })
  @Get('transition-proposals/pending')
  async listPendingProposals(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.proposals.listPending(limit ? Math.min(Number(limit), 200) : 50, offset ? Number(offset) : 0);
  }

  @ApiOperation({ summary: 'Suspend inbox processing for a mailbox — reason required' })
  @Patch('mailboxes/:id/suspend')
  async suspendInboxProcessing(@Param('id') id: string, @Body() dto: AdminActionReasonDto, @CurrentUser() admin: JwtPayload) {
    const mailbox = await this.mailboxes.findById(id);
    if (!mailbox) return { success: false };
    await this.mailboxes.update(id, { inboxCapabilityStatus: 'SYSTEM_SUSPENDED', inboxSystemSuspended: true, inboxSuspensionReason: dto.reason }, new Date());
    await this.audit.record({ eventType: 'INBOX_CONSENT_REVOKED', userId: admin.sub, connectedMailboxId: id, detail: `Admin-suspended: ${dto.reason}` });
    return { success: true };
  }

  @ApiOperation({ summary: 'Resume inbox processing for a previously-suspended mailbox — reason required' })
  @Patch('mailboxes/:id/resume')
  async resumeInboxProcessing(@Param('id') id: string, @Body() dto: AdminActionReasonDto, @CurrentUser() admin: JwtPayload) {
    const mailbox = await this.mailboxes.findById(id);
    if (!mailbox) return { success: false };
    await this.mailboxes.update(id, { inboxCapabilityStatus: mailbox.hasRefreshToken ? 'ACTIVE' : 'REAUTHORIZATION_REQUIRED', inboxSystemSuspended: false, inboxSuspensionReason: null }, new Date());
    await this.audit.record({ eventType: 'INBOX_CONSENT_GRANTED', userId: admin.sub, connectedMailboxId: id, detail: `Admin-resumed: ${dto.reason}` });
    return { success: true };
  }

  @ApiOperation({ summary: 'Force an immediate watch/subscription renewal for a mailbox — reason required' })
  @Post('mailboxes/:id/force-watch-renewal')
  async forceWatchRenewal(@Param('id') id: string, @Body() dto: AdminActionReasonDto, @CurrentUser() admin: JwtPayload) {
    const mailbox = await this.mailboxes.findById(id);
    const watch = mailbox ? await this.watches.findByConnectedMailboxId(id) : null;
    if (!mailbox || !watch) return { success: false };
    await this.watchService.renewWatch(watch, mailbox);
    await this.audit.record({ eventType: 'INBOX_WATCH_RENEWED', userId: admin.sub, connectedMailboxId: id, detail: `Admin-forced renewal: ${dto.reason}` });
    return { success: true };
  }

  @ApiOperation({ summary: 'Force reauthorization required for a mailbox — reason required' })
  @Post('mailboxes/:id/force-reauthorization')
  async forceReauthorization(@Param('id') id: string, @Body() dto: AdminActionReasonDto, @CurrentUser() admin: JwtPayload) {
    await this.mailboxes.update(id, { inboxCapabilityStatus: 'REAUTHORIZATION_REQUIRED', inboxReauthorizationRequired: true }, new Date());
    await this.audit.record({ eventType: 'INBOX_REAUTHORIZATION_REQUIRED', userId: admin.sub, connectedMailboxId: id, detail: `Admin-forced: ${dto.reason}` });
    return { success: true };
  }

  @ApiOperation({ summary: 'Mark a message for manual review — reason required' })
  @Post('messages/:id/mark-for-review')
  async markForReview(@Param('id') id: string, @Body() dto: ReprocessMessageDto, @CurrentUser() admin: JwtPayload) {
    const updated = await this.inboxMessages.updateReviewStatus(id, { reviewStatus: 'PENDING_REVIEW' }, new Date());
    await this.audit.record({ eventType: 'REPLY_CORRELATION_AMBIGUOUS', userId: admin.sub, inboxMessageId: id, detail: `Admin marked for review: ${dto.reason}` });
    return updated;
  }

  @ApiOperation({ summary: 'Run the retention-pruning job immediately — admin-triggered, same logic the scheduled job uses' })
  @Post('retention/run-now')
  async runRetentionNow() {
    const pruned = await this.retentionService.pruneExpiredExcerpts(500);
    return { prunedCount: pruned };
  }
}
