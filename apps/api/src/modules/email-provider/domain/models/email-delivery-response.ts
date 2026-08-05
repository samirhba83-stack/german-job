import { DeliveryStatus } from './delivery-status';
import { ProviderFailure } from './provider-failure';

/**
 * A provider-independent, always-explainable result of one delivery attempt. `providerMetadata`
 * is a deliberately open string-keyed bag (e.g. a provider's own message id) so a future provider
 * can surface extra, provider-specific detail without ever changing this contract's shape.
 */
export interface EmailDeliveryResponse {
  readonly providerId: string;
  readonly status: DeliveryStatus;
  /** Convenience flag, always equal to `status === 'ACCEPTED'`. */
  readonly accepted: boolean;
  readonly executedAt: Date;
  readonly providerMessage: string;
  readonly providerMetadata: Readonly<Record<string, string>>;
  /** Present only when `accepted` is false. */
  readonly failure: ProviderFailure | null;
}
