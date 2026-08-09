import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { MetricsPort, METRICS_PORT } from '../../../../shared/infrastructure/observability/metrics/metrics.port';
import { EmailQueueRepository, EMAIL_QUEUE_REPOSITORY } from '../../domain/ports/email-queue.repository';
import {
  EmailProviderWebhookEventRepository,
  EMAIL_PROVIDER_WEBHOOK_EVENT_REPOSITORY,
} from '../../domain/ports/email-provider-webhook-event.repository';
import { NormalizedWebhookEvent } from '../../domain/models/normalized-webhook-event';
import { ResendWebhookVerifier, ResendWebhookVerificationError } from '../../infrastructure/webhooks/resend-webhook-verifier';
import { SendGridWebhookVerifier, SendGridWebhookVerificationError } from '../../infrastructure/webhooks/sendgrid-webhook-verifier';
import { SesSnsVerifier, SesSnsVerificationError } from '../../infrastructure/webhooks/ses-sns-verifier';
import { DeliverabilityService } from './deliverability.service';

export type EmailWebhookOutcome = 'PROCESSED' | 'DUPLICATE' | 'REJECTED' | 'MESSAGE_NOT_FOUND' | 'IGNORED_UNKNOWN_TYPE' | 'PROCESSING_DISABLED';

/**
 * M28 — the real webhook intake for all three event-capable providers (Resend/SES/SendGrid;
 * plain SMTP has no webhook concept — see `SmtpEmailProviderAdapter`'s own doc comment).
 * Signature verification always happens before anything else; a real, dedicated
 * `EmailProviderWebhookEvent` row provides replay/duplicate protection (mirrors the M27 billing
 * `WebhookProcessingService`'s identical structure for the same reason); an event for a message
 * this application has no record of is a real, named outcome (`MESSAGE_NOT_FOUND`) — not an
 * error, not silently dropped, not guessed at.
 */
@Injectable()
export class EmailWebhookProcessingService {
  private readonly logger = new Logger(EmailWebhookProcessingService.name);

  constructor(
    private readonly resendVerifier: ResendWebhookVerifier,
    private readonly sendgridVerifier: SendGridWebhookVerifier,
    private readonly sesVerifier: SesSnsVerifier,
    @Inject(EMAIL_PROVIDER_WEBHOOK_EVENT_REPOSITORY) private readonly webhookEvents: EmailProviderWebhookEventRepository,
    @Inject(EMAIL_QUEUE_REPOSITORY) private readonly queue: EmailQueueRepository,
    private readonly deliverability: DeliverabilityService,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly config: ConfigService,
    @Inject(METRICS_PORT) private readonly metrics: MetricsPort,
  ) {}

  async processResend(rawBody: Buffer, headers: { svixId?: string; svixTimestamp?: string; svixSignature?: string }): Promise<EmailWebhookOutcome> {
    try {
      const event = this.resendVerifier.verify(rawBody, headers);
      return this.dispatch('resend', event, rawBody);
    } catch (error) {
      return this.reject('resend', rawBody, error, headers.svixId);
    }
  }

  async processSendGrid(rawBody: Buffer, headers: { signature?: string; timestamp?: string }): Promise<EmailWebhookOutcome> {
    let events: NormalizedWebhookEvent[];
    try {
      events = this.sendgridVerifier.verifyBatch(rawBody, headers);
    } catch (error) {
      return this.reject('sendgrid', rawBody, error);
    }

    const outcomes = await Promise.all(events.map((event) => this.dispatch('sendgrid', event, rawBody)));
    if (outcomes.some((outcome) => outcome === 'PROCESSED')) return 'PROCESSED';
    if (outcomes.some((outcome) => outcome === 'MESSAGE_NOT_FOUND')) return 'MESSAGE_NOT_FOUND';
    return outcomes[0] ?? 'IGNORED_UNKNOWN_TYPE';
  }

  /** Returns `subscribeUrl` when this call was SNS's own subscription-confirmation handshake
   * (already completed by the time this returns — the real GET to `SubscribeURL` happens here,
   * only after the envelope's own structural + host checks pass). */
  async processSes(rawBody: Buffer): Promise<{ outcome: EmailWebhookOutcome; subscribeUrl?: string }> {
    let envelope: { SigningCertURL?: string };
    try {
      envelope = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return { outcome: await this.reject('ses', rawBody, new Error('Body is not valid JSON.')) };
    }

    try {
      if (!envelope.SigningCertURL) throw new SesSnsVerificationError('Missing SigningCertURL.');
      this.sesVerifier.assertRealSnsHost(envelope.SigningCertURL);
      const certificatePem = await this.fetchCertificate(envelope.SigningCertURL);
      this.sesVerifier.verifySignature(rawBody, certificatePem);
    } catch (error) {
      return { outcome: await this.reject('ses', rawBody, error) };
    }

    const parsed = this.sesVerifier.parse(rawBody);
    if (parsed.kind === 'SUBSCRIPTION_CONFIRMATION') {
      await this.confirmSnsSubscription(parsed.subscribeUrl);
      return { outcome: 'PROCESSED', subscribeUrl: parsed.subscribeUrl };
    }

    const outcome = await this.dispatch('ses', parsed.event, rawBody);
    return { outcome };
  }

  private async dispatch(provider: string, event: NormalizedWebhookEvent, rawBody: Buffer): Promise<EmailWebhookOutcome> {
    // M31.1 Phase 11 — real doc 13 "Webhook failures" catalogue metric. Recorded once per real
    // outcome via this single return-path wrapper, so every branch below (including ones added in
    // the future) is covered by construction rather than requiring a metric call at every return.
    const record = (outcome: EmailWebhookOutcome): EmailWebhookOutcome => {
      this.metrics.incrementCounter('email_webhook.outcome', { provider, outcome });
      return outcome;
    };

    const existing = await this.webhookEvents.findByProviderEventId(provider, event.providerEventId);
    if (existing) {
      this.logger.log(`Duplicate ${provider} webhook event ${event.providerEventId} — already ${existing.status}, ignoring.`);
      return record('DUPLICATE');
    }

    const rawPayloadHash = createHash('sha256').update(rawBody).digest('hex');
    const recordId = await this.webhookEvents.recordReceived({
      provider,
      providerEventId: event.providerEventId,
      eventType: event.eventType,
      signatureValid: true,
      rawPayloadHash,
    });

    const message = await this.queue.findByProviderMessageId(provider, event.providerMessageId);
    if (!message) {
      this.logger.warn(`${provider} webhook event ${event.providerEventId} references unknown providerMessageId "${event.providerMessageId}" — left at RECEIVED for review.`);
      return record('MESSAGE_NOT_FOUND');
    }

    // M31 Phase 26 — the real, additional Production Safety Flag: this provider's own real-world
    // webhook certification (Phase 9/10/11) is prepared but not yet executed, so the mutating side
    // effect (marking delivered/bounced/complained/opened/clicked) stays off by default even
    // though the event is authenticated and durably recorded above. The caller still gets a real,
    // provider-expected acknowledgement (see the controller) — this is "acknowledge but do not
    // act," never a silent drop and never a failure response that would make the provider retry-
    // storm or disable the subscription.
    if (!this.config.get<boolean>('productionSafety.productionWebhookProcessingEnabled', false)) {
      this.logger.warn(`${provider} webhook event ${event.providerEventId} authenticated and recorded, but production webhook processing is disabled — skipped.`);
      return record('PROCESSING_DISABLED');
    }

    switch (event.eventType) {
      case 'DELIVERED':
        await this.deliverability.handleDelivered(message, provider);
        break;
      case 'BOUNCE_HARD':
        await this.deliverability.handleHardBounce(message, provider, event.detail);
        break;
      case 'BOUNCE_SOFT':
        await this.deliverability.handleSoftBounce(message, provider, event.detail);
        break;
      case 'COMPLAINT':
        await this.deliverability.handleComplaint(message, provider, event.detail);
        break;
      case 'OPEN':
        await this.deliverability.handleOpened(message, provider);
        break;
      case 'CLICK':
        await this.deliverability.handleClicked(message, provider, event.clickedUrl);
        break;
      default:
        this.logger.warn(`${provider} webhook event ${event.providerEventId} has an unrecognized type — left at RECEIVED.`);
        return record('IGNORED_UNKNOWN_TYPE');
    }

    await this.webhookEvents.markProcessed(recordId, this.clock.now());
    return record('PROCESSED');
  }

  private async reject(provider: string, rawBody: Buffer, error: unknown, providerEventIdHint?: string): Promise<EmailWebhookOutcome> {
    const reason =
      error instanceof ResendWebhookVerificationError || error instanceof SendGridWebhookVerificationError || error instanceof SesSnsVerificationError || error instanceof Error
        ? error.message
        : String(error);
    const rawPayloadHash = createHash('sha256').update(rawBody).digest('hex');
    const recordId = await this.webhookEvents.recordReceived({
      provider,
      providerEventId: providerEventIdHint ?? `rejected:${rawPayloadHash}:${this.clock.now().getTime()}`,
      eventType: 'UNKNOWN',
      signatureValid: false,
      rawPayloadHash,
    });
    await this.webhookEvents.markRejected(recordId, reason, this.clock.now());
    this.logger.warn(`Rejected ${provider} webhook: ${reason}`);
    this.metrics.incrementCounter('email_webhook.outcome', { provider, outcome: 'REJECTED' });
    return 'REJECTED';
  }

  private async fetchCertificate(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new SesSnsVerificationError(`Failed to fetch SNS signing certificate: HTTP ${response.status}`);
    }
    return response.text();
  }

  /** SNS's real subscription handshake — a GET to the auto-generated `SubscribeURL` (already
   * host-validated by `assertRealSnsHost` before this is ever called) is what actually confirms
   * the subscription; SNS will keep redelivering the SubscriptionConfirmation message until this
   * happens. */
  private async confirmSnsSubscription(subscribeUrl: string): Promise<void> {
    try {
      const response = await fetch(subscribeUrl);
      this.logger.log(`SNS subscription confirmation GET returned HTTP ${response.status}.`);
    } catch (error) {
      this.logger.error(`Failed to confirm SNS subscription: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
