import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProviderPort } from '../../domain/ports/email-provider.port';
import { EmailDeliveryRequest } from '../../domain/models/email-delivery-request';
import { EmailDeliveryResponse } from '../../domain/models/email-delivery-response';
import { ProviderCapabilities } from '../../domain/models/provider-capabilities';
import { ProviderFailureCategory } from '../../domain/models/provider-failure';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { checkAttachmentSizeAgainstCapability } from '../../domain/services/attachment-size-estimator';

interface SendGridErrorBody {
  errors?: { message: string; field?: string | null }[];
}

/**
 * M28 — real SendGrid adapter (Mail Send API v3, hand-rolled REST — same rationale as
 * `ResendEmailProviderAdapter`: a simple bearer-token JSON API doesn't justify the official
 * `@sendgrid/mail` SDK's dependency surface). SendGrid returns `202 Accepted` with an empty body
 * on success and the provider message id in the `X-Message-Id` response header — there is no id
 * in a JSON body to parse, unlike Resend.
 *
 * M28.5 — `supportsAttachments` is now honestly `true`, on the same terms as every other adapter
 * here — see `ResendEmailProviderAdapter`'s doc comment for the resolution contract every adapter
 * shares.
 */
@Injectable()
export class SendGridEmailProviderAdapter implements EmailProviderPort {
  readonly providerId = 'sendgrid';
  private readonly logger = new Logger(SendGridEmailProviderAdapter.name);
  private static readonly BASE_URL = 'https://api.sendgrid.com/v3';

  constructor(
    private readonly config: ConfigService,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
  ) {}

  private get apiKey(): string {
    return this.config.get<string>('emailInfrastructure.sendgrid.apiKey', '');
  }

  getCapabilities(): ProviderCapabilities {
    return {
      providerId: this.providerId,
      supportsAttachments: true,
      supportsHtml: true,
      supportsPlainText: true,
      // SendGrid's own documented total-message-size limit (30MB, including attachments).
      maxAttachmentSizeBytes: 30 * 1024 * 1024,
      maxRecipientsPerRequest: 1000,
      dailyDeliveryLimit: this.config.get<number | null>('emailInfrastructure.sendgrid.dailyLimit', null),
      requiresAuthentication: true,
      supportedAuthenticationMethods: ['API_KEY'],
    };
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }

  async send(request: EmailDeliveryRequest): Promise<EmailDeliveryResponse> {
    const now = this.clock.now();
    if (!this.apiKey) {
      return this.failure(request, now, 'AUTHENTICATION', 'SENDGRID_API_KEY is not configured.', false);
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

    const content: { type: string; value: string }[] = [];
    if (request.plainTextBody) content.push({ type: 'text/plain', value: request.plainTextBody });
    if (request.htmlBody) content.push({ type: 'text/html', value: request.htmlBody });

    try {
      const response = await fetch(`${SendGridEmailProviderAdapter.BASE_URL}/mail/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: request.recipientEmailAddress }], custom_args: { requestId: request.requestId } }],
          from: { email: request.sender.emailAddress, name: request.sender.displayName },
          reply_to: request.sender.replyToEmailAddress ? { email: request.sender.replyToEmailAddress } : undefined,
          subject: request.subject,
          content,
          attachments: request.resolvedAttachments?.map((attachment) => ({
            content: attachment.content.toString('base64'),
            filename: attachment.fileName,
            type: attachment.mimeType,
            disposition: 'attachment',
          })),
        }),
      });

      if (response.status === 202) {
        const messageId = response.headers.get('x-message-id') ?? 'unknown';
        return {
          providerId: this.providerId,
          status: 'ACCEPTED',
          accepted: true,
          executedAt: now,
          providerMessage: `SendGrid accepted the message (id ${messageId}).`,
          providerMetadata: { sendgridMessageId: messageId, providerMessageId: messageId },
          failure: null,
        };
      }

      const body = (await response.json().catch(() => ({}))) as SendGridErrorBody;
      return this.mapErrorResponse(request, now, response.status, body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`SendGrid send failed for request "${request.requestId}": ${message}`);
      return this.failure(request, now, 'PROVIDER_UNAVAILABLE', `Network error calling SendGrid: ${message}`, true);
    }
  }

  private mapErrorResponse(request: EmailDeliveryRequest, now: Date, status: number, body: SendGridErrorBody): EmailDeliveryResponse {
    const message = body.errors?.map((e) => e.message).join('; ') ?? `SendGrid returned HTTP ${status} with no message.`;
    if (status === 401 || status === 403) {
      return this.failure(request, now, 'AUTHENTICATION', message, false);
    }
    if (status === 429) {
      return this.failure(request, now, 'RATE_LIMITED', message, true);
    }
    if (status === 400) {
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
      providerMessage: `SendGrid did not accept request "${request.requestId}": ${message}`,
      providerMetadata: {},
      failure: { category, message, retryable },
    };
  }
}
