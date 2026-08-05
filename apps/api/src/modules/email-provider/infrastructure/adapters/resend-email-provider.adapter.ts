import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProviderPort } from '../../domain/ports/email-provider.port';
import { EmailDeliveryRequest } from '../../domain/models/email-delivery-request';
import { EmailDeliveryResponse } from '../../domain/models/email-delivery-response';
import { ProviderCapabilities } from '../../domain/models/provider-capabilities';
import { ProviderFailureCategory } from '../../domain/models/provider-failure';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { checkAttachmentSizeAgainstCapability } from '../../domain/services/attachment-size-estimator';

interface ResendSendResponseBody {
  id?: string;
  message?: string;
  name?: string;
}

/**
 * M28 — real Resend adapter (REST API v1, hand-rolled against the platform's native `fetch`
 * rather than the official `resend` SDK — consistent with this codebase's established
 * payments/provider-adapter precedent (`PaddlePaymentAdapter`, M27): a supply-chain-risk judgment
 * call for a small, well-documented, bearer-token JSON API where a full SDK buys little over a
 * ~40-line hand-rolled client.
 *
 * M28.5 — `supportsAttachments` is now honestly `true`: `EmailProviderManagerService` resolves
 * `EmailAttachmentSpec.contentReference` into real bytes via the one authoritative
 * `AttachmentResolverPort` *before* this adapter's `send()` is ever called, and hands them over as
 * `request.resolvedAttachments`. This adapter never resolves a reference itself — if
 * `attachments` is non-empty but `resolvedAttachments` is missing (a caller bypassed the
 * resolver), `send()` refuses rather than silently sending without the attachment.
 */
@Injectable()
export class ResendEmailProviderAdapter implements EmailProviderPort {
  readonly providerId = 'resend';
  private readonly logger = new Logger(ResendEmailProviderAdapter.name);
  private static readonly BASE_URL = 'https://api.resend.com';

  constructor(
    private readonly config: ConfigService,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
  ) {}

  private get apiKey(): string {
    return this.config.get<string>('emailInfrastructure.resend.apiKey', '');
  }

  getCapabilities(): ProviderCapabilities {
    return {
      providerId: this.providerId,
      supportsAttachments: true,
      supportsHtml: true,
      supportsPlainText: true,
      // Resend's own documented total-request-payload limit (covers the whole JSON body,
      // attachments included) — a real, cited provider limit, not a guess.
      maxAttachmentSizeBytes: 40 * 1024 * 1024,
      maxRecipientsPerRequest: 50,
      dailyDeliveryLimit: this.config.get<number | null>('emailInfrastructure.resend.dailyLimit', null),
      requiresAuthentication: true,
      supportedAuthenticationMethods: ['API_KEY'],
    };
  }

  /** Availability is "is this adapter even configured" — real per-request health (rate limits,
   * outages) is the Provider Manager's job (circuit breaker over real send() outcomes), not
   * something this method probes for with an extra API call on every selection decision. */
  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }

  async send(request: EmailDeliveryRequest): Promise<EmailDeliveryResponse> {
    const now = this.clock.now();
    if (!this.apiKey) {
      return this.failure(request, now, 'AUTHENTICATION', 'RESEND_API_KEY is not configured.', false);
    }
    if (!request.htmlBody && !request.plainTextBody) {
      return this.failure(request, now, 'UNSUPPORTED_CAPABILITY', 'Request has neither an HTML nor a plain-text body.', false);
    }
    if (request.attachments.length > 0 && (!request.resolvedAttachments || request.resolvedAttachments.length === 0)) {
      return this.failure(request, now, 'UNSUPPORTED_CAPABILITY', 'Request declares attachments but none were resolved to real bytes before send() was called.', false);
    }
    if (request.resolvedAttachments) {
      const sizeIssue = checkAttachmentSizeAgainstCapability(request.resolvedAttachments, this.getCapabilities().maxAttachmentSizeBytes);
      if (sizeIssue) {
        return this.failure(request, now, 'PROVIDER_UNAVAILABLE', sizeIssue, true);
      }
    }

    try {
      const response = await fetch(`${ResendEmailProviderAdapter.BASE_URL}/emails`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${request.sender.displayName} <${request.sender.emailAddress}>`,
          to: [request.recipientEmailAddress],
          reply_to: request.sender.replyToEmailAddress ?? undefined,
          subject: request.subject,
          text: request.plainTextBody ?? undefined,
          html: request.htmlBody ?? undefined,
          headers: { 'X-Entity-Ref-ID': request.requestId },
          attachments: request.resolvedAttachments?.map((attachment) => ({
            filename: attachment.fileName,
            content: attachment.content.toString('base64'),
          })),
        }),
      });

      const body = (await response.json().catch(() => ({}))) as ResendSendResponseBody;

      if (response.ok && body.id) {
        return {
          providerId: this.providerId,
          status: 'ACCEPTED',
          accepted: true,
          executedAt: now,
          providerMessage: `Resend accepted the message (id ${body.id}).`,
          providerMetadata: { resendMessageId: body.id, providerMessageId: body.id },
          failure: null,
        };
      }

      return this.mapErrorResponse(request, now, response.status, body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Resend send failed for request "${request.requestId}": ${message}`);
      return this.failure(request, now, 'PROVIDER_UNAVAILABLE', `Network error calling Resend: ${message}`, true);
    }
  }

  private mapErrorResponse(request: EmailDeliveryRequest, now: Date, status: number, body: ResendSendResponseBody): EmailDeliveryResponse {
    const message = body.message ?? `Resend returned HTTP ${status} with no message.`;
    if (status === 401 || status === 403) {
      return this.failure(request, now, 'AUTHENTICATION', message, false);
    }
    if (status === 429) {
      return this.failure(request, now, 'RATE_LIMITED', message, true);
    }
    if (status === 422 || status === 400) {
      return this.failure(request, now, 'INVALID_RECIPIENT', message, false);
    }
    if (status >= 500) {
      return this.failure(request, now, 'PROVIDER_UNAVAILABLE', message, true);
    }
    return this.failure(request, now, 'UNKNOWN', message, false);
  }

  private failure(
    request: EmailDeliveryRequest,
    now: Date,
    category: ProviderFailureCategory,
    message: string,
    retryable: boolean,
  ): EmailDeliveryResponse {
    return {
      providerId: this.providerId,
      status: category === 'RATE_LIMITED' ? 'DEFERRED' : category === 'INVALID_RECIPIENT' ? 'REJECTED' : 'FAILED',
      accepted: false,
      executedAt: now,
      providerMessage: `Resend did not accept request "${request.requestId}": ${message}`,
      providerMetadata: {},
      failure: { category, message, retryable },
    };
  }
}
