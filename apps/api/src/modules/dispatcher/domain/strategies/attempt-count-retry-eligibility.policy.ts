import { CampaignTarget } from '../../../campaigns/domain/entities/campaign-target.entity';
import { PolicyDecision } from '../../../campaigns/domain/policies/campaign-policy.interface';
import { RetryPolicy } from '../../../campaigns/domain/policies/retry.policy';
import { RetryEligibilityPolicy } from '../ports/retry-eligibility.port';

/**
 * Default RETRY_ELIGIBILITY_POLICY binding — delegates entirely to the existing RetryPolicy
 * (attempt-count check) that Campaign.retryFailedTargets() already enforces. Deliberately adds
 * no new behavior: day-based delay and company-policy-aware retries are future-milestone work:
 * this class exists so the port has a real, non-stub default rather than one that always
 * allows or always denies.
 */
export class AttemptCountRetryEligibilityPolicy implements RetryEligibilityPolicy {
  evaluate(target: CampaignTarget, _now: Date): PolicyDecision {
    return new RetryPolicy().authorize(target.dispatchAttempts.length);
  }
}
