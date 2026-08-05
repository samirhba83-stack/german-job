import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { PolicyDecision } from '../../../campaigns/domain/policies/campaign-policy.interface';

export const INBOX_PROTECTION_STRATEGY = Symbol('INBOX_PROTECTION_STRATEGY');

export interface RiskAssessment {
  readonly riskScore: number;
  readonly decision: PolicyDecision;
}

/**
 * Assesses spam/deliverability risk for a campaign and decides whether execution should be
 * refused. A DI port so a future milestone can replace the deterministic-arithmetic default
 * (InboxProtectionPolicy) with a trained risk model without changing CampaignDispatcherService —
 * this is the primary "future AI evolution" seam for Milestone 4's core philosophy (optimize for
 * successful delivery, never for send volume).
 */
export interface InboxProtectionStrategy {
  assess(campaign: Campaign, now: Date): RiskAssessment;
}
