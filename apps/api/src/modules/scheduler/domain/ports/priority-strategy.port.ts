import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';

export const PRIORITY_STRATEGY = Symbol('PRIORITY_STRATEGY');

/**
 * Computes a campaign's execution-order score. A DI port so a future milestone can replace the
 * deterministic-arithmetic default (CampaignPriorityPolicy) with an ML-tuned or otherwise
 * "AI capability" implementation without changing CampaignSchedulerService.
 */
export interface PriorityStrategy {
  evaluate(campaign: Campaign, now: Date): number;
}
