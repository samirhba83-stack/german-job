import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailDeliveryRequest } from '../../../email-provider/domain/models/email-delivery-request';
import { ProviderSelectionCriteria } from '../../../provider-selection/domain/models/provider-selection-criteria';
import { EmailQueueRepository, EMAIL_QUEUE_REPOSITORY } from '../../domain/ports/email-queue.repository';
import { EmailProviderManagerPort, EMAIL_PROVIDER_MANAGER_PORT } from '../../domain/ports/email-provider-manager.port';
import { EmailMessageRecord, EnqueueEmailInput } from '../../domain/models/email-message';
import { EmailTrackingService } from './email-tracking.service';
import { DeliverabilityService } from './deliverability.service';

/**
 * M28 — the production email queue's application-layer API: enqueue (idempotent, suppression-
 * checked) and process-one-claimed-message (provider-manager-backed send, with real
 * retry-with-backoff or dead-lettering on failure). `EmailQueueWorkerService` is the only real
 * caller of `processClaimed()` — this class holds no scheduling/ticking logic itself, matching
 * `CampaignExecutionEntryPointService`/`ExecutionTickDriverService`'s established split between
 * "the one real entry point" and "the thing that decides when to call it."
 */
@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(
    @Inject(EMAIL_QUEUE_REPOSITORY) private readonly queue: EmailQueueRepository,
    @Inject(EMAIL_PROVIDER_MANAGER_PORT) private readonly providerManager: EmailProviderManagerPort,
    private readonly deliverability: DeliverabilityService,
    private readonly tracking: EmailTrackingService,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly config: ConfigService,
  ) {}

  /** Idempotent by `idempotencyKey` — a caller retrying the same enqueue call gets the existing
   * row back, never a duplicate send (M28 "Duplicate protection"). Suppression is checked here,
   * before the message ever reaches the queue's ready-to-send state, never bypassed regardless of
   * priority. */
  async enqueue(input: EnqueueEmailInput): Promise<EmailMessageRecord> {
    const existing = await this.queue.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return existing;
    }

    const now = this.clock.now();
    const created = await this.queue.enqueue(input, now);
    await this.tracking.track(created.id, 'QUEUED', { metadata: { priority: created.priority } });

    if (await this.deliverability.isSuppressed(input.recipientEmail)) {
      await this.queue.markSuppressed(created.id, now);
      await this.tracking.track(created.id, 'SUPPRESSED_SKIP', { detail: `${input.recipientEmail} is on the suppression list.` });
      return { ...created, status: 'SUPPRESSED' };
    }

    return created;
  }

  /** Processes exactly one already-claimed message (status SENDING) — never claims itself; the
   * repository's `claimBatch()` is the sole, concurrency-safe claim path. */
  async processClaimed(message: EmailMessageRecord): Promise<void> {
    const now = this.clock.now();
    await this.tracking.track(message.id, 'SENDING_STARTED', { metadata: { attempt: String(message.attempts) } });

    const request: EmailDeliveryRequest = {
      requestId: message.idempotencyKey,
      sender: { displayName: message.senderName, emailAddress: message.senderEmail },
      recipientEmailAddress: message.recipientEmail,
      subject: message.subject,
      plainTextBody: message.plainTextBody,
      htmlBody: message.htmlBody,
      attachments: message.attachmentsMeta,
    };
    const criteria: ProviderSelectionCriteria = {
      requiresAttachments: message.attachmentsMeta.length > 0,
      requiresHtml: message.htmlBody !== null,
      requiresPlainText: message.plainTextBody !== null,
      recipientCount: 1,
      correlationId: message.correlationId,
      traceId: message.traceId,
    };

    const result = await this.providerManager.sendWithFailover(request, criteria);

    for (const attempt of result.attempts) {
      await this.tracking.track(message.id, attempt.skippedCircuitOpen ? 'PROVIDER_FAILOVER' : 'PROVIDER_SELECTED', {
        providerId: attempt.providerId,
        detail: attempt.response.providerMessage,
      });
    }

    if (result.response.accepted) {
      const providerMessageId = result.response.providerMetadata.providerMessageId ?? null;
      await this.queue.markSent(message.id, result.response.providerId, providerMessageId || null, now);
      await this.tracking.track(message.id, 'SENT', { providerId: result.response.providerId, detail: result.response.providerMessage });
      return;
    }

    await this.handleFailure(message, result.response.providerMessage, result.response.failure?.retryable ?? false, now);
  }

  private async handleFailure(message: EmailMessageRecord, reason: string, retryable: boolean, now: Date): Promise<void> {
    if (!retryable || message.attempts >= message.maxAttempts) {
      await this.queue.markDeadLetter(message.id, reason, now);
      await this.tracking.track(message.id, 'DEAD_LETTERED', { detail: reason, metadata: { attempts: String(message.attempts) } });
      this.logger.warn(`Email message ${message.id} dead-lettered after ${message.attempts} attempt(s): ${reason}`);
      return;
    }

    const backoffMs = this.computeBackoff(message.attempts);
    const nextAttemptAt = new Date(now.getTime() + backoffMs);
    await this.queue.markDeferredForRetry(message.id, reason, nextAttemptAt, now);
    await this.tracking.track(message.id, 'RETRY_SCHEDULED', { detail: `Next attempt at ${nextAttemptAt.toISOString()}: ${reason}` });
  }

  /** Full jitter-free exponential backoff, capped — `baseBackoffMs * 2^(attempts-1)`, matching
   * the standard retry-queue formula the brief's own "Backoff strategy" line asks for. */
  private computeBackoff(attempts: number): number {
    const base = this.config.get<number>('emailInfrastructure.queue.baseBackoffMs', 30_000);
    const max = this.config.get<number>('emailInfrastructure.queue.maxBackoffMs', 1_800_000);
    const exponential = base * Math.pow(2, Math.max(0, attempts - 1));
    return Math.min(exponential, max);
  }
}
