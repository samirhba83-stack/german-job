import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { EmailProviderPort } from '../../domain/ports/email-provider.port';
import { EmailDeliveryRequest } from '../../domain/models/email-delivery-request';
import { EmailDeliveryResponse } from '../../domain/models/email-delivery-response';
import { ProviderCapabilities } from '../../domain/models/provider-capabilities';
import { ProviderFailureCategory } from '../../domain/models/provider-failure';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { buildRawMimeEmail } from './mime-message-builder';
import { checkAttachmentSizeAgainstCapability } from '../../domain/services/attachment-size-estimator';

const AUTH_ERROR_NAMES = new Set(['UnrecognizedClientException', 'InvalidClientTokenId', 'AccessDenied', 'AccessDeniedException', 'SignatureDoesNotMatch']);
const REJECTION_ERROR_NAMES = new Set(['MessageRejected', 'MailFromDomainNotVerifiedException']);
const THROTTLING_ERROR_NAMES = new Set(['Throttling', 'ThrottlingException', 'TooManyRequestsException']);

/**
 * M28 — real Amazon SES adapter, using the official `@aws-sdk/client-ses` — deliberately NOT
 * hand-rolled against the raw REST API the way `ResendEmailProviderAdapter`/
 * `SendGridEmailProviderAdapter` are. AWS request signing (SigV4) is a real, intricate,
 * security-critical algorithm; hand-rolling it introduces genuine correctness/security risk for
 * no real benefit over the official, AWS-maintained SDK — the opposite trade-off from Resend/
 * SendGrid's trivial bearer-token REST calls, where a full SDK buys little.
 *
 * SES's own bounce/complaint feedback arrives via Amazon SNS notifications, handled by a separate
 * webhook controller (M28 Deliverability), not this adapter.
 *
 * M28.5 — `supportsAttachments` is now honestly `true`. SES's simple `SendEmailCommand` has no
 * attachment support at all; real attachment delivery uses `SendRawEmailCommand` with a hand-built
 * MIME message (`buildRawMimeEmail`, `mime-message-builder.ts`) — a first-class, AWS-documented
 * SES API path, not a workaround. This adapter now always builds a raw MIME message (even for
 * attachment-free sends) so there is exactly one code path to reason about and test, rather than
 * branching between two different SES APIs depending on whether attachments are present.
 */
@Injectable()
export class SesEmailProviderAdapter implements EmailProviderPort {
  readonly providerId = 'ses';
  private readonly logger = new Logger(SesEmailProviderAdapter.name);
  private client: SESClient | null = null;

  constructor(
    private readonly config: ConfigService,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
  ) {}

  private get sesConfig() {
    return {
      region: this.config.get<string>('emailInfrastructure.ses.region', ''),
      accessKeyId: this.config.get<string>('emailInfrastructure.ses.accessKeyId', ''),
      secretAccessKey: this.config.get<string>('emailInfrastructure.ses.secretAccessKey', ''),
    };
  }

  private getClient(): SESClient {
    if (this.client) return this.client;
    const { region, accessKeyId, secretAccessKey } = this.sesConfig;
    this.client = new SESClient({ region, credentials: { accessKeyId, secretAccessKey } });
    return this.client;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      providerId: this.providerId,
      supportsAttachments: true,
      supportsHtml: true,
      supportsPlainText: true,
      // AWS SES's documented total raw-message size limit (headers + body + attachments).
      maxAttachmentSizeBytes: 10 * 1024 * 1024,
      maxRecipientsPerRequest: 50,
      dailyDeliveryLimit: this.config.get<number | null>('emailInfrastructure.ses.dailyLimit', null),
      requiresAuthentication: true,
      supportedAuthenticationMethods: ['API_KEY'],
    };
  }

  async isAvailable(): Promise<boolean> {
    const { region, accessKeyId, secretAccessKey } = this.sesConfig;
    return region.length > 0 && accessKeyId.length > 0 && secretAccessKey.length > 0;
  }

  async send(request: EmailDeliveryRequest): Promise<EmailDeliveryResponse> {
    const now = this.clock.now();
    const { region, accessKeyId, secretAccessKey } = this.sesConfig;
    if (!region || !accessKeyId || !secretAccessKey) {
      return this.failure(request, now, 'AUTHENTICATION', 'AWS SES credentials are not fully configured.', false);
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
      const rawMessage = buildRawMimeEmail({
        fromDisplayName: request.sender.displayName,
        fromEmailAddress: request.sender.emailAddress,
        toEmailAddress: request.recipientEmailAddress,
        replyToEmailAddress: request.sender.replyToEmailAddress ?? null,
        subject: request.subject,
        plainTextBody: request.plainTextBody,
        htmlBody: request.htmlBody,
        attachments: (request.resolvedAttachments ?? []).map((attachment) => ({ fileName: attachment.fileName, mimeType: attachment.mimeType, content: attachment.content })),
      });

      const command = new SendRawEmailCommand({
        Source: `${request.sender.displayName} <${request.sender.emailAddress}>`,
        Destinations: [request.recipientEmailAddress],
        RawMessage: { Data: rawMessage },
        Tags: [{ Name: 'requestId', Value: this.sanitizeTagValue(request.requestId) }],
      });

      const result = await this.getClient().send(command);
      return {
        providerId: this.providerId,
        status: 'ACCEPTED',
        accepted: true,
        executedAt: now,
        providerMessage: `SES accepted the message (id ${result.MessageId ?? 'unknown'}).`,
        providerMetadata: { sesMessageId: result.MessageId ?? '', providerMessageId: result.MessageId ?? '' },
        failure: null,
      };
    } catch (error) {
      return this.mapSendError(request, now, error);
    }
  }

  // SES message tags only allow letters, numbers, underscores, and hyphens.
  private sanitizeTagValue(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 256);
  }

  private mapSendError(request: EmailDeliveryRequest, now: Date, error: unknown): EmailDeliveryResponse {
    const name = (error as { name?: string } | null)?.name ?? 'UNKNOWN';
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`SES send failed for request "${request.requestId}" (${name}): ${message}`);

    if (AUTH_ERROR_NAMES.has(name)) {
      return this.failure(request, now, 'AUTHENTICATION', message, false);
    }
    if (REJECTION_ERROR_NAMES.has(name)) {
      return this.failure(request, now, 'INVALID_RECIPIENT', message, false);
    }
    if (THROTTLING_ERROR_NAMES.has(name)) {
      return this.failure(request, now, 'RATE_LIMITED', message, true);
    }
    const httpStatus = (error as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata?.httpStatusCode;
    if (httpStatus && httpStatus >= 500) {
      return this.failure(request, now, 'PROVIDER_UNAVAILABLE', message, true);
    }
    return this.failure(request, now, 'PROVIDER_UNAVAILABLE', message, true);
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
      providerMessage: `SES did not accept request "${request.requestId}": ${message}`,
      providerMetadata: {},
      failure: { category, message, retryable },
    };
  }
}
