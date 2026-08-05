import { EmailDeliveryRequest } from '../models/email-delivery-request';
import { EmailDeliveryResponse } from '../models/email-delivery-response';
import { ProviderCapabilities } from '../models/provider-capabilities';

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

/**
 * The stable contract every email delivery provider implements — SMTP, Gmail API, Microsoft
 * Graph, Amazon SES, Mailgun, SendGrid, or any future provider. Nothing that depends on this
 * interface (the Worker, a future EmailProviderGatewayService consumer, etc.) may know which
 * concrete provider is bound; adding a new provider means writing one new adapter class that
 * implements this interface and changing only its DI binding — no other code changes.
 */
export interface EmailProviderPort {
  readonly providerId: string;
  getCapabilities(): ProviderCapabilities;
  isAvailable(): Promise<boolean>;
  send(request: EmailDeliveryRequest): Promise<EmailDeliveryResponse>;
}
