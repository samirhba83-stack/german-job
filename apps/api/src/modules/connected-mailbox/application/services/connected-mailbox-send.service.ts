import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConnectedMailboxRepository, CONNECTED_MAILBOX_REPOSITORY } from '../../domain/ports/connected-mailbox.repository';
import { ConnectedMailboxSendAttemptRepository, CONNECTED_MAILBOX_SEND_ATTEMPT_REPOSITORY } from '../../domain/ports/connected-mailbox-send-attempt.repository';
import { ConnectedMailboxProviderPort, CONNECTED_MAILBOX_PROVIDERS } from '../../domain/ports/connected-mailbox-provider.port';
import { ConnectedMailboxRecord, ConnectedMailboxProvider, ConnectedMailboxUpdatePatch } from '../../domain/models/connected-mailbox';
import { FrozenMailboxAttachmentRef } from '../../domain/models/connected-mailbox-send-attempt';
import { MailboxSendRequest } from '../../domain/models/mailbox-send';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { AttachmentResolverPort, ATTACHMENT_RESOLVER_PORT } from '../../../documents/domain/ports/attachment-resolver.port';
import { AttachmentReferenceContext } from '../../../documents/domain/models/resolved-attachment';
import { EmailAttachmentSpec } from '../../../email-provider/domain/models/email-attachment';
import { EmailDeliveryResponse } from '../../../email-provider/domain/models/email-delivery-response';
import { ConnectedMailboxReadinessService } from './connected-mailbox-readiness.service';
import { ConnectedMailboxRateLimiterService } from './connected-mailbox-rate-limiter.service';
import { MailboxTokenVaultService } from './mailbox-token-vault.service';

export interface SendCandidateApplicationParams {
  readonly requestId: string;
  readonly userId: string;
  readonly applicationId: string;
  readonly campaignId: string | null;
  readonly recipientEmailAddress: string;
  readonly subject: string;
  readonly plainTextBody: string | null;
  readonly htmlBody: string | null;
  readonly attachments: ReadonlyArray<EmailAttachmentSpec>;
  readonly correlationId: string | null;
  readonly traceId: string | null;
}

class MailboxAuthenticationError extends Error {}

/**
 * M28.6 Phase 11 — the authoritative candidate-application dispatch orchestrator. This is the
 * ONLY path a candidate application email can travel: readiness gate → attachment resolution
 * (reusing M28.5's single authoritative resolver) → immutable reservation (idempotent) → a
 * bounded, single-attempt token refresh if needed → the real provider adapter → outcome recorded
 * everywhere real state lives. On any block, returns a synthesized failure response — never calls
 * `EmailProviderManagerService`/the platform sender as a silent fallback (Phase 8/11's own
 * non-negotiable instruction; also see `PLATFORM_FALLBACK_REJECTED` in the audit vocabulary,
 * recorded by the caller if it were ever tempted to fall back — this service itself simply never
 * offers that code path at all).
 */
@Injectable()
export class ConnectedMailboxSendService {
  private readonly logger = new Logger(ConnectedMailboxSendService.name);

  constructor(
    @Inject(CONNECTED_MAILBOX_REPOSITORY) private readonly mailboxes: ConnectedMailboxRepository,
    @Inject(CONNECTED_MAILBOX_SEND_ATTEMPT_REPOSITORY) private readonly sendAttempts: ConnectedMailboxSendAttemptRepository,
    @Inject(CONNECTED_MAILBOX_PROVIDERS) private readonly providers: ConnectedMailboxProviderPort[],
    @Inject(ATTACHMENT_RESOLVER_PORT) private readonly attachmentResolver: AttachmentResolverPort,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly readiness: ConnectedMailboxReadinessService,
    private readonly rateLimiter: ConnectedMailboxRateLimiterService,
    private readonly tokenVault: MailboxTokenVaultService,
    private readonly audit: EmailSecurityAuditService,
  ) {}

  async sendCandidateApplication(params: SendCandidateApplicationParams): Promise<{ response: EmailDeliveryResponse }> {
    const now = this.clock.now();

    const readinessResult = await this.readiness.checkReadiness({ userId: params.userId, recipientEmailAddress: params.recipientEmailAddress });
    if (!readinessResult.ready || !readinessResult.mailbox) {
      return { response: this.gateFailureResponse(readinessResult.blockingReasons.join(' '), now) };
    }
    const mailbox = readinessResult.mailbox;

    const references: AttachmentReferenceContext[] = params.attachments.map((a) => ({
      documentId: a.contentReference,
      requestingUserId: params.userId,
      applicationContextId: params.applicationId,
    }));
    const resolution = references.length > 0 ? await this.attachmentResolver.resolve(references) : { resolved: [], failure: null };
    if (resolution.failure) {
      await this.audit.record({ eventType: 'CONNECTED_SEND_BLOCKED', connectedMailboxId: mailbox.id, userId: params.userId, applicationId: params.applicationId, detail: resolution.failure.detail });
      return { response: this.gateFailureResponse(`Attachment resolution failed: ${resolution.failure.detail}`, now) };
    }

    const bodyChecksum = createHash('sha256').update(`${params.subject}\n${params.plainTextBody ?? ''}\n${params.htmlBody ?? ''}`).digest('hex');
    const attachmentRefs: FrozenMailboxAttachmentRef[] = resolution.resolved.map((r) => ({
      documentId: r.documentId,
      version: r.version,
      checksumSha256: r.checksumSha256,
      fileName: r.fileName,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
    }));

    const idempotencyKey = `connected-mailbox:${params.requestId}`;
    const attempt = await this.sendAttempts.reserve(
      {
        idempotencyKey,
        connectedMailboxId: mailbox.id,
        verifiedSenderEmail: mailbox.emailAddress,
        provider: mailbox.provider,
        providerAccountId: mailbox.providerAccountId,
        applicationId: params.applicationId,
        campaignId: params.campaignId,
        recipientEmail: params.recipientEmailAddress,
        subject: params.subject,
        bodyChecksumSha256: bodyChecksum,
        attachmentRefs,
        correlationId: params.correlationId,
        traceId: params.traceId,
      },
      now,
    );

    if (attempt.status === 'SENT') {
      // A genuine retry of an already-completed logical send — Phase 12: "never send duplicate
      // messages" — return the frozen prior outcome rather than calling the provider again.
      return { response: this.acceptedResponseFromAttempt(mailbox, attempt.providerMessageId, attempt.providerThreadId, now) };
    }

    await this.audit.record({ eventType: 'CONNECTED_SEND_STARTED', connectedMailboxId: mailbox.id, userId: params.userId, applicationId: params.applicationId });
    await this.sendAttempts.incrementAttempts(attempt.id, now);

    let accessToken: string;
    try {
      accessToken = await this.getValidAccessToken(mailbox, now);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.sendAttempts.markOutcome(attempt.id, 'FAILED', { lastFailureCategory: 'AUTHENTICATION', lastFailureReason: message }, now);
      await this.mailboxes.update(mailbox.id, { status: 'REAUTHORIZATION_REQUIRED', reauthorizationRequired: true, failureCategory: 'AUTHENTICATION', failureReason: message, lastFailureAt: now }, now);
      await this.audit.record({ eventType: 'MAILBOX_REAUTHORIZATION_REQUIRED', connectedMailboxId: mailbox.id, userId: params.userId, detail: message });
      return { response: this.failureResponse(mailbox, message, 'AUTHENTICATION', false, now) };
    }

    const adapter = this.resolveProvider(mailbox.provider);
    const sendRequest: MailboxSendRequest = {
      requestId: params.requestId,
      fromDisplayName: mailbox.displayName ?? mailbox.emailAddress,
      fromEmailAddress: mailbox.emailAddress,
      recipientEmailAddress: params.recipientEmailAddress,
      subject: params.subject,
      plainTextBody: params.plainTextBody,
      htmlBody: params.htmlBody,
      resolvedAttachments: resolution.resolved.map((r) => ({ fileName: r.fileName, mimeType: r.mimeType, sizeBytes: r.sizeBytes, content: r.content })),
    };

    const sendResult = await adapter.sendMessage(accessToken, sendRequest);
    await this.rateLimiter.recordAttempt(mailbox.id);

    if (sendResult.accepted) {
      await this.sendAttempts.markOutcome(attempt.id, 'SENT', { providerMessageId: sendResult.providerMessageId, providerThreadId: sendResult.providerThreadId, rfcMessageId: sendResult.rfcMessageId }, now);
      await this.mailboxes.update(mailbox.id, { lastSuccessfulSendAt: now }, now);
      await this.audit.record({ eventType: 'CONNECTED_SEND_ACCEPTED', connectedMailboxId: mailbox.id, userId: params.userId, applicationId: params.applicationId, detail: sendResult.providerMessage });
      return { response: this.acceptedResponseFromAttempt(mailbox, sendResult.providerMessageId, sendResult.providerThreadId, now) };
    }

    const failureCategory = sendResult.failure?.category ?? 'UNKNOWN';
    await this.sendAttempts.markOutcome(attempt.id, 'FAILED', { lastFailureCategory: failureCategory, lastFailureReason: sendResult.failure?.message ?? sendResult.providerMessage }, now);
    await this.mailboxes.update(mailbox.id, { lastFailureAt: now, failureCategory: this.mapToMailboxFailureCategory(failureCategory), failureReason: sendResult.providerMessage }, now);
    await this.audit.record({
      eventType: failureCategory === 'RATE_LIMITED' ? 'CONNECTED_SEND_RATE_LIMITED' : 'CONNECTED_SEND_FAILED',
      connectedMailboxId: mailbox.id,
      userId: params.userId,
      applicationId: params.applicationId,
      detail: sendResult.providerMessage,
    });

    return {
      response: {
        providerId: mailbox.provider === 'GOOGLE_GMAIL' ? 'connected-gmail' : 'connected-outlook',
        status: sendResult.status,
        accepted: false,
        executedAt: now,
        providerMessage: sendResult.providerMessage,
        providerMetadata: {},
        failure: sendResult.failure,
      },
    };
  }

  /** Exactly one refresh attempt — never retried indefinitely (Phase 9's explicit instruction).
   * A 60-second safety margin avoids a token expiring mid-flight to the provider. */
  private async getValidAccessToken(mailbox: ConnectedMailboxRecord, now: Date): Promise<string> {
    const cachedAccessToken = this.tokenVault.decryptAccessToken(mailbox);
    if (cachedAccessToken && mailbox.accessTokenExpiresAt && mailbox.accessTokenExpiresAt.getTime() > now.getTime() + 60_000) {
      return cachedAccessToken;
    }

    const refreshToken = this.tokenVault.decryptRefreshToken(mailbox);
    const adapter = this.resolveProvider(mailbox.provider);

    let refreshed;
    try {
      refreshed = await adapter.refreshAccessToken(refreshToken);
    } catch (error) {
      throw new MailboxAuthenticationError(`Access token refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const encryptedAccess = this.tokenVault.encryptAccessToken(refreshed.accessToken);
    const newExpiresAt = new Date(now.getTime() + refreshed.expiresInSeconds * 1000);
    const patch: ConnectedMailboxUpdatePatch = {
      encryptedAccessToken: encryptedAccess.ciphertext,
      accessTokenExpiresAt: newExpiresAt,
      tokenEncryptionVersion: encryptedAccess.keyVersion,
      lastRefreshedAt: now,
      ...(refreshed.refreshToken ? { encryptedRefreshToken: this.tokenVault.encryptRefreshToken(refreshed.refreshToken).ciphertext } : {}),
    };
    await this.mailboxes.update(mailbox.id, patch, now);
    await this.audit.record({ eventType: 'MAILBOX_TOKEN_REFRESHED', connectedMailboxId: mailbox.id, userId: mailbox.userId });
    return refreshed.accessToken;
  }

  private resolveProvider(provider: ConnectedMailboxProvider): ConnectedMailboxProviderPort {
    const adapter = this.providers.find((p) => p.provider === provider);
    if (!adapter) {
      throw new Error(`No connected-mailbox provider adapter registered for "${provider}".`);
    }
    return adapter;
  }

  private gateFailureResponse(message: string, now: Date): EmailDeliveryResponse {
    return {
      providerId: 'connected-mailbox-gate',
      status: 'UNSUPPORTED',
      accepted: false,
      executedAt: now,
      providerMessage: message,
      providerMetadata: {},
      failure: { category: 'UNSUPPORTED_CAPABILITY', message, retryable: false },
    };
  }

  private failureResponse(mailbox: ConnectedMailboxRecord, message: string, category: 'AUTHENTICATION', retryable: boolean, now: Date): EmailDeliveryResponse {
    return {
      providerId: mailbox.provider === 'GOOGLE_GMAIL' ? 'connected-gmail' : 'connected-outlook',
      status: 'FAILED',
      accepted: false,
      executedAt: now,
      providerMessage: message,
      providerMetadata: {},
      failure: { category, message, retryable },
    };
  }

  private acceptedResponseFromAttempt(mailbox: ConnectedMailboxRecord, providerMessageId: string | null, providerThreadId: string | null, now: Date): EmailDeliveryResponse {
    return {
      providerId: mailbox.provider === 'GOOGLE_GMAIL' ? 'connected-gmail' : 'connected-outlook',
      status: 'ACCEPTED',
      accepted: true,
      executedAt: now,
      providerMessage: `Sent from the candidate's own connected mailbox (${mailbox.emailAddress}).`,
      providerMetadata: { providerMessageId: providerMessageId ?? '', providerThreadId: providerThreadId ?? '' },
      failure: null,
    };
  }

  private mapToMailboxFailureCategory(category: string): 'AUTHENTICATION' | 'RATE_LIMITED' | 'PROVIDER_UNAVAILABLE' | 'UNKNOWN' {
    if (category === 'AUTHENTICATION' || category === 'RATE_LIMITED' || category === 'PROVIDER_UNAVAILABLE') return category;
    return 'UNKNOWN';
  }
}
