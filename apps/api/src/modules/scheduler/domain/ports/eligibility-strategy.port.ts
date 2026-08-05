import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { PolicyDecision } from '../../../campaigns/domain/policies/campaign-policy.interface';

export const ELIGIBILITY_STRATEGY = Symbol('ELIGIBILITY_STRATEGY');

export interface EligibilityEvaluation {
  readonly decision: PolicyDecision;
  /** 0 when the campaign is not eligible. */
  readonly plannedBatchSize: number;
}

/**
 * Decides whether a campaign could execute right now. A DI port so a future milestone can
 * replace the rule-composition default (CampaignEligibilityPolicy) with a different strategy
 * without changing CampaignSchedulerService.
 */
export interface EligibilityStrategy {
  evaluate(campaign: Campaign, now: Date): EligibilityEvaluation;
}
