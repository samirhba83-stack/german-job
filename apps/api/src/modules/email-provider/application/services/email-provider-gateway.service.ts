import { Inject, Injectable } from '@nestjs/common';
import { EmailProviderPort, EMAIL_PROVIDER } from '../../domain/ports/email-provider.port';
import { EmailDeliveryRequest } from '../../domain/models/email-delivery-request';
import { EmailDeliveryResponse } from '../../domain/models/email-delivery-response';
import { ProviderCapabilities } from '../../domain/models/provider-capabilities';

/**
 * The application-layer boundary consumers use instead of depending on EmailProviderPort (or any
 * concrete provider) directly. Every method is a thin delegation to the injected provider — this
 * service holds no delivery logic, no provider-specific knowledge, and no state of its own, so
 * swapping the EMAIL_PROVIDER binding (Null -> SMTP -> Gmail -> ...) never requires a change
 * here. This is the seam the Worker's future email-aware TaskExecutionPort binding would call
 * through — not wired into the Worker this milestone (see module doc comment for why).
 */
@Injectable()
export class EmailProviderGatewayService {
  constructor(@Inject(EMAIL_PROVIDER) private readonly provider: EmailProviderPort) {}

  getProviderId(): string {
    return this.provider.providerId;
  }

  getCapabilities(): ProviderCapabilities {
    return this.provider.getCapabilities();
  }

  checkAvailability(): Promise<boolean> {
    return this.provider.isAvailable();
  }

  send(request: EmailDeliveryRequest): Promise<EmailDeliveryResponse> {
    return this.provider.send(request);
  }
}
