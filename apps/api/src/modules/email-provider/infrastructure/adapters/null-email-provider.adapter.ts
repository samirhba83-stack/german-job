import { Inject, Injectable } from '@nestjs/common';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailProviderPort } from '../../domain/ports/email-provider.port';
import { EmailDeliveryRequest } from '../../domain/models/email-delivery-request';
import { EmailDeliveryResponse } from '../../domain/models/email-delivery-response';
import { ProviderCapabilities } from '../../domain/models/provider-capabilities';

/**
 * Default EMAIL_PROVIDER binding for this milestone. Not a "provider" in the SMTP/Gmail/
 * Microsoft Graph sense — it is the honest placeholder for "no real provider is configured yet",
 * proving the contract is genuinely usable end to end without hardcoding any delivery
 * technology. Performs no I/O, no network call, no authentication. This is the exact slot a real
 * adapter occupies in a future milestone, via a different DI binding only.
 */
@Injectable()
export class NullEmailProvider implements EmailProviderPort {
  readonly providerId = 'null-provider';

  constructor(@Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock) {}

  getCapabilities(): ProviderCapabilities {
    return {
      providerId: this.providerId,
      supportsAttachments: false,
      supportsHtml: false,
      supportsPlainText: true,
      maxAttachmentSizeBytes: null,
      maxRecipientsPerRequest: 1,
      dailyDeliveryLimit: 0,
      requiresAuthentication: false,
      supportedAuthenticationMethods: [],
    };
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async send(request: EmailDeliveryRequest): Promise<EmailDeliveryResponse> {
    return {
      providerId: this.providerId,
      status: 'UNSUPPORTED',
      accepted: false,
      executedAt: this.clock.now(),
      providerMessage: `No email provider is configured; request "${request.requestId}" was not sent.`,
      providerMetadata: {},
      failure: {
        category: 'PROVIDER_UNAVAILABLE',
        message: 'No real email provider is configured for this environment yet.',
        retryable: false,
      },
    };
  }
}
