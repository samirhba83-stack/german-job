export const RECOMMENDATION_CONFIG = Symbol('RECOMMENDATION_CONFIG');

export interface RiskMitigationConfig {
  /** Risk scores at or above this (but not yet hard-denied) trigger a mitigation recommendation. */
  readonly elevatedRiskThreshold: number;
  readonly expectedImpactWeight: number;
}

export interface CompanyHistoricalSuccessConfig {
  /** Historical success scores at or above this are worth calling out as a targeting priority. */
  readonly highSuccessThreshold: number;
  readonly expectedImpactWeight: number;
}

export interface CampaignHealthConfig {
  /** Health scores below this trigger a strategy-review recommendation. */
  readonly lowHealthThreshold: number;
  readonly expectedImpactWeight: number;
}

/** Business-tunable thresholds and weights for the Recommendation Engine. Provided via DI
 * (RECOMMENDATION_CONFIG) so every threshold can be tuned — or eventually sourced from persisted
 * configuration — without touching any strategy. */
export interface RecommendationConfig {
  readonly riskMitigation: RiskMitigationConfig;
  readonly companyHistoricalSuccess: CompanyHistoricalSuccessConfig;
  readonly campaignHealth: CampaignHealthConfig;
  /** Caps how many recommendations a single campaign contributes to the final ranked list. */
  readonly maxRecommendationsPerCampaign: number;
}

export const DEFAULT_RECOMMENDATION_CONFIG: RecommendationConfig = {
  riskMitigation: {
    elevatedRiskThreshold: 0.5,
    expectedImpactWeight: 1,
  },
  companyHistoricalSuccess: {
    highSuccessThreshold: 0.7,
    expectedImpactWeight: 1,
  },
  campaignHealth: {
    lowHealthThreshold: 0.4,
    expectedImpactWeight: 1,
  },
  maxRecommendationsPerCampaign: 5,
};
