import { DeliveryStatus } from '../../email-provider/domain/models/delivery-status';
import { ProviderFailure } from '../../email-provider/domain/models/provider-failure';

/**
 * The Email Delivery Execution Service's fully explainable translation of one provider response
 * for one executed task. Richer than the Worker's own TaskExecutionOutcome (success/reason/
 * failureReason) — this is the shape callers (tests, future observability) inspect when they
 * need the full provider-independent explanation, not just the pass/fail Worker needs to
 * transition a task. `executionId` is the source ExecutionTask's id, so this result is always
 * traceable back to the exact task it came from.
 */
export interface EmailDeliveryExecutionResult {
  readonly executionId: string;
  readonly providerId: string;
  readonly status: DeliveryStatus;
  readonly accepted: boolean;
  readonly executedAt: Date;
  readonly providerMessage: string;
  readonly providerMetadata: Readonly<Record<string, string>>;
  readonly failure: ProviderFailure | null;
}
