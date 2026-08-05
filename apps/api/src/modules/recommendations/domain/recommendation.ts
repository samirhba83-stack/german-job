export type RecommendationCategory = 'RISK' | 'TARGETING' | 'STRATEGY' | 'TIMING' | 'BATCH_SIZING';

/**
 * What a RecommendationStrategy itself produces — domain-layer business
 * judgment, no identity of its own yet. RecommendationEngineService
 * (application layer) assigns each candidate a durable id (M18) the moment
 * it collects them, the same "id generated where it's used" pattern as
 * command handlers elsewhere (e.g. CreateProfileHandler's randomUUID()).
 */
export interface RecommendationCandidate {
  readonly campaignId: string;
  readonly category: RecommendationCategory;
  /** Short, human-readable summary of the suggested action. */
  readonly title: string;
  /** WHY this recommendation was produced — must always be present and specific. */
  readonly explanation: string;
  readonly reasonCode: string;
  /** 0..1 — used to rank recommendations; higher means more valuable if acted on. */
  readonly expectedImpactScore: number;
  /** Which RecommendationStrategy produced this — observability, mirrors decisionLog elsewhere. */
  readonly producedBy: string;
}

/**
 * An explainable, actionable suggestion for the candidate to consider before execution begins.
 * The Recommendation Engine advises; it never acts — nothing about a Recommendation causes any
 * execution to happen or change.
 */
export interface Recommendation extends RecommendationCandidate {
  /** Assigned once, by RecommendationEngineService, the moment the candidate is collected (M18) — lets a later Decision or event genuinely reference "this specific recommendation" rather than a synthesized stand-in. */
  readonly id: string;
}
