import { Injectable } from '@nestjs/common';
import { CampaignStatus, CampaignTargetStatus } from '@german-job-engine/shared-types';
import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { ExecutionWindowPolicy } from '../../../campaigns/domain/policies/execution-window.policy';
import { RateLimitPolicy } from '../../../campaigns/domain/policies/rate-limit.policy';
import { PolicyDecision, allow, deny } from '../../../campaigns/domain/policies/campaign-policy.interface';
import { EligibilityEvaluation, EligibilityStrategy } from '../ports/eligibility-strategy.port';

/**
 * Composes the same enforced rules Campaign.planNextBatch() applies at dispatch time — status,
 * pending work, cooldown, execution window, rate limit — into a single read-only eligibility
 * verdict. The Scheduler uses this to decide WHETHER a campaign could run right now; it never
 * mutates the campaign, so it deliberately reimplements no policy, only composes the existing
 * ones (ExecutionWindowPolicy, RateLimitPolicy) plus checks planNextBatch enforces via its own
 * guards (RUNNING status, non-empty pending set).
 *
 * COOLING_DOWN is checked before the generic "not RUNNING" rejection and reported under its own
 * reasonCode: it's a distinct, expected state (Campaign.resume()/confirmResume() always clears
 * `cooldown` by the time status reaches RUNNING again, so RUNNING campaigns never carry an
 * active cooldown — the cooldown field only exists to read while COOLING_DOWN).
 */
@Injectable()
export class CampaignEligibilityPolicy implements EligibilityStrategy {
  evaluate(campaign: Campaign, now: Date): EligibilityEvaluation {
    if (campaign.status === CampaignStatus.COOLING_DOWN) {
      const explanation = campaign.cooldown
        ? `Campaign is cooling down until ${campaign.cooldown.until.toISOString()}.`
        : 'Campaign is cooling down.';
      return this.ineligible(deny('COOLDOWN_ACTIVE', explanation));
    }

    if (campaign.status !== CampaignStatus.RUNNING) {
      return this.ineligible(deny('NOT_RUNNING', `Campaign status is ${campaign.status}, not RUNNING.`));
    }

    const pendingCount = campaign.targets.filter((target) => target.status === CampaignTargetStatus.PENDING).length;
    if (pendingCount === 0) {
      return this.ineligible(deny('NO_PENDING_TARGETS', 'Campaign has no pending targets to dispatch.'));
    }

    const windowDecision = new ExecutionWindowPolicy().authorize(campaign.executionWindow, now);
    if (!windowDecision.allowed) {
      return this.ineligible(deny('OUTSIDE_EXECUTION_WINDOW', windowDecision.explanation));
    }

    const dispatchedInLast24h = campaign.dispatchedInLast24Hours(now);
    const rateLimitDecision = new RateLimitPolicy().authorize(1, dispatchedInLast24h, campaign.rateLimitProfile);
    if (!rateLimitDecision.allowed) {
      return this.ineligible(deny('RATE_LIMIT_EXHAUSTED', rateLimitDecision.explanation));
    }

    const remainingDailyCapacity = campaign.rateLimitProfile.maxPerDay - dispatchedInLast24h;
    const plannedBatchSize = Math.min(pendingCount, campaign.batchPlan.baseBatchSize, remainingDailyCapacity);

    return { decision: allow(), plannedBatchSize };
  }

  private ineligible(decision: PolicyDecision): EligibilityEvaluation {
    return { decision, plannedBatchSize: 0 };
  }
}
