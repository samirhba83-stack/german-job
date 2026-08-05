export const INTELLIGENT_TIMING_STRATEGY = Symbol('INTELLIGENT_TIMING_STRATEGY');

export interface TimingRecommendation {
  readonly recommendedAt: Date;
  readonly reasonCode: string;
  readonly explanation: string;
}

/**
 * Recommends the best moment to execute from an engagement-likelihood perspective (advisory
 * only — distinct from the hard ExecutionWindow gate). A DI port so a future milestone can
 * replace the business-hours heuristic default (IntelligentTimingPolicy) with a per-company or
 * ML-tuned recommender without changing CampaignDispatcherService.
 */
export interface IntelligentTimingStrategy {
  recommend(from: Date, timezone: string): TimingRecommendation;
}
