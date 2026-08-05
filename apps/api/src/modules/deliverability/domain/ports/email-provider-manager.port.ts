import { EmailDeliveryRequest } from '../../../email-provider/domain/models/email-delivery-request';
import { EmailDeliveryResponse } from '../../../email-provider/domain/models/email-delivery-response';
import { ProviderSelectionCriteria } from '../../../provider-selection/domain/models/provider-selection-criteria';

export const EMAIL_PROVIDER_MANAGER_PORT = Symbol('EMAIL_PROVIDER_MANAGER_PORT');

/** One provider attempt's full outcome, in the order actually tried — the real audit trail
 * behind "automatic failover" (M28), never summarized away. */
export interface EmailProviderAttempt {
  readonly providerId: string;
  readonly response: EmailDeliveryResponse;
  /** True when this attempt was skipped without a real network call because the provider's
   * circuit breaker was open — still recorded, since "we didn't even try X because it was
   * unhealthy" is real, useful information for tracking/admin visibility. */
  readonly skippedCircuitOpen: boolean;
}

export interface EmailProviderManagerResult {
  /** The final, decisive outcome — the last real attempt's response, or a synthesized
   * "no eligible provider" response when nothing was even attempted. */
  readonly response: EmailDeliveryResponse;
  readonly attempts: ReadonlyArray<EmailProviderAttempt>;
}

/**
 * M28 — the real "Provider Manager": selection (delegated to the existing
 * `ProviderSelectionEnginePort`, reused rather than duplicated), health-aware automatic failover
 * across every eligible provider in priority order, a per-provider circuit breaker, and a
 * bounded per-attempt timeout. Deliberately a distinct port from `EmailProviderPort` — this is an
 * orchestrator over several providers, not a provider itself, so it takes explicit
 * `ProviderSelectionCriteria` rather than trying to squeeze that decision inside a `send()` call
 * shaped for exactly one provider.
 *
 * "Retry logic"/"backoff strategy" here means immediate, synchronous failover to the *next*
 * eligible provider within the same call — appropriate for a caller that needs an answer now
 * (the Worker). Longer, delayed retry-with-backoff of the *same* logical email (minutes later,
 * several times, then dead-letter) is the Email Queue's job (M28 Queue System), not this port's —
 * a synchronous caller cannot "wait 30 seconds and try again" mid-call.
 */
export interface EmailProviderManagerPort {
  sendWithFailover(request: EmailDeliveryRequest, criteria: ProviderSelectionCriteria): Promise<EmailProviderManagerResult>;
}
