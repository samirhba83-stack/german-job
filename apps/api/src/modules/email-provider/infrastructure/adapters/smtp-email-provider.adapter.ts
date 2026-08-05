import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { EmailProviderPort } from '../../domain/ports/email-provider.port';
import { EmailDeliveryRequest } from '../../domain/models/email-delivery-request';
import { EmailDeliveryResponse } from '../../domain/models/email-delivery-response';
import { ProviderCapabilities } from '../../domain/models/provider-capabilities';
import { ProviderFailureCategory } from '../../domain/models/provider-failure';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';

/**
 * M28 — the generic SMTP adapter, for any provider/mail server that only speaks standard SMTP
 * (a self-hosted mail server, a provider with no REST API, or a fallback of last resort). Uses
 * `nodemailer` — unlike the REST-based adapters in this same folder, hand-rolling the SMTP
 * protocol itself (TLS negotiation, AUTH mechanisms, MIME encoding) by hand would be a real,
 * unjustified correctness/security risk; `nodemailer` is the de facto standard, widely-audited
 * choice for this specific job, not "an unnecessary library."
 *
 * The transporter is created once per adapter instance (connection pooling is nodemailer's own
 * concern) rather than per `send()` call.
 *
 * Real, honest limitation named up front (see M28 engineering report): raw SMTP has no standard
 * webhook/callback mechanism, so this adapter can report a message as ACCEPTED by the remote MTA
 * but can never itself learn about a later bounce, complaint, open, or click — those signals only
 * exist for Resend/SES/SendGrid, which offer real event webhooks. This is a genuine capability
 * gap of the SMTP protocol itself, not something this adapter could paper over honestly.
 *
 * M28.5 — `supportsAttachments` is now honestly `true`; nodemailer's own `attachments` option
 * accepts a `Buffer` directly, so this adapter needs no extra encoding step, unlike the REST-based
 * adapters (nodemailer base64-encodes internally as part of MIME construction).
 */
@Injectable()
export class SmtpEmailProviderAdapter implements EmailProviderPort {
  readonly providerId = 'smtp';
  private readonly logger = new Logger(SmtpEmailProviderAdapter.name);
  private transporter: Transporter | null = null;

  constructor(
    private readonly config: ConfigService,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
  ) {}

  private get smtpConfig() {
    return {
      host: this.config.get<string>('emailInfrastructure.smtp.host', ''),
      port: this.config.get<number>('emailInfrastructure.smtp.port', 587),
      secure: this.config.get<boolean>('emailInfrastructure.smtp.secure', false),
      user: this.config.get<string>('emailInfrastructure.smtp.user', ''),
      password: this.config.get<string>('emailInfrastructure.smtp.password', ''),
    };
  }

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    const { host, port, secure, user, password } = this.smtpConfig;
    this.transporter = createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass: password } : undefined,
      // A bounded connection-time timeout — the Provider Manager applies its own overall
      // send-timeout on top of this, but nodemailer's own socket-level timeout prevents a single
      // hung TCP connection from blocking indefinitely below that.
      connectionTimeout: 10_000,
      // Explicit, not merely nodemailer's implicit default — M28.5 Phase 7 requires this
      // guarantee to be visible and intentional, never silently relying on an unstated default
      // that a future refactor could accidentally invert.
      tls: { rejectUnauthorized: true },
    });
    return this.transporter;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      providerId: this.providerId,
      supportsAttachments: true,
      supportsHtml: true,
      supportsPlainText: true,
      // No universal SMTP-protocol size limit exists — this is genuinely server-specific, so
      // `null` (unknown) is the honest value here, unlike Resend/SendGrid's documented API limits.
      maxAttachmentSizeBytes: null,
      maxRecipientsPerRequest: 1,
      dailyDeliveryLimit: this.config.get<number | null>('emailInfrastructure.smtp.dailyLimit', null),
      requiresAuthentication: true,
      supportedAuthenticationMethods: ['BASIC'],
    };
  }

  async isAvailable(): Promise<boolean> {
    return this.smtpConfig.host.length > 0;
  }

  async send(request: EmailDeliveryRequest): Promise<EmailDeliveryResponse> {
    const now = this.clock.now();
    if (!this.smtpConfig.host) {
      return this.failure(request, now, 'AUTHENTICATION', 'SMTP_HOST is not configured.', false);
    }
    if (!request.htmlBody && !request.plainTextBody) {
      return this.failure(request, now, 'UNSUPPORTED_CAPABILITY', 'Request has neither an HTML nor a plain-text body.', false);
    }
    if (request.attachments.length > 0 && (!request.resolvedAttachments || request.resolvedAttachments.length === 0)) {
      return this.failure(request, now, 'UNSUPPORTED_CAPABILITY', 'Request declares attachments but none were resolved to real bytes before send() was called.', false);
    }

    try {
      const info = await this.getTransporter().sendMail({
        from: `"${request.sender.displayName}" <${request.sender.emailAddress}>`,
        to: request.recipientEmailAddress,
        replyTo: request.sender.replyToEmailAddress ?? undefined,
        subject: request.subject,
        text: request.plainTextBody ?? undefined,
        html: request.htmlBody ?? undefined,
        headers: { 'X-Request-Id': request.requestId },
        attachments: request.resolvedAttachments?.map((attachment) => ({
          filename: attachment.fileName,
          content: attachment.content,
          contentType: attachment.mimeType,
        })),
      });

      return {
        providerId: this.providerId,
        status: 'ACCEPTED',
        accepted: true,
        executedAt: now,
        providerMessage: `SMTP server accepted the message (id ${info.messageId}).`,
        providerMetadata: { smtpMessageId: info.messageId, providerMessageId: info.messageId, smtpResponse: info.response ?? '' },
        failure: null,
      };
    } catch (error) {
      return this.mapSendError(request, now, error);
    }
  }

  private mapSendError(request: EmailDeliveryRequest, now: Date, error: unknown): EmailDeliveryResponse {
    const message = error instanceof Error ? error.message : String(error);
    // nodemailer surfaces the SMTP reply code on `.responseCode` when the remote server rejected
    // the message — a real, provider-independent-enough signal to classify retryability by,
    // matching the same 4xx-transient/5xx-permanent convention SMTP itself defines.
    const responseCode = (error as { responseCode?: number } | null)?.responseCode;
    this.logger.warn(`SMTP send failed for request "${request.requestId}": ${message}`);

    if (responseCode && responseCode >= 500) {
      return this.failure(request, now, 'INVALID_RECIPIENT', message, false);
    }
    if (responseCode && responseCode >= 400) {
      return this.failure(request, now, 'RATE_LIMITED', message, true);
    }
    const code = (error as { code?: string } | null)?.code;
    if (code === 'EAUTH') {
      return this.failure(request, now, 'AUTHENTICATION', message, false);
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
      providerMessage: `SMTP did not accept request "${request.requestId}": ${message}`,
      providerMetadata: {},
      failure: { category, message, retryable },
    };
  }
}
