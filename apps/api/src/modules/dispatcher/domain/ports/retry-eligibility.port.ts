import { CampaignTarget } from '../../../campaigns/domain/entities/campaign-target.entity';
import { PolicyDecision } from '../../../campaigns/domain/policies/campaign-policy.interface';

export const RETRY_ELIGIBILITY_POLICY = Symbol('RETRY_ELIGIBILITY_POLICY');

/**
 * Extension point for Milestone 4's "Retry Strategy" requirement: prepares the architecture for
 * future intelligent retries (delay-of-several-days, per-company retry policy) without
 * implementing them yet. The default binding (AttemptCountRetryEligibilityPolicy) only wraps
 * the existing attempt-count check Campaign.retryFailedTargets() already enforces via
 * RetryPolicy — no new retry behavior is added in M4. A future milestone replaces the DI
 * binding with a richer policy; nothing that calls this port needs to change.
 */
export interface RetryEligibilityPolicy {
  evaluate(target: CampaignTarget, now: Date): PolicyDecision;
}
