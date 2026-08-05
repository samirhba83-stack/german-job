import { Recommendation, RecommendationCategory } from '../../recommendations/domain/recommendation';

/** All recommendations that shared a category — more than one candidate means the engine had to
 * pick a single winner for that decision axis. */
export interface ConflictGroup {
  readonly category: RecommendationCategory;
  readonly candidates: ReadonlyArray<Recommendation>;
}

/** One recommendation as it was weighed during aggregation — present for every recommendation
 * considered, not just the winner, so the decision stays fully traceable. */
export interface EvidenceEntry {
  readonly recommendation: Recommendation;
  readonly resolvedPriority: number;
  readonly selected: boolean;
}

/**
 * What a DecisionAggregationStrategy itself produces — domain-layer
 * judgment, no identity of its own yet. DecisionIntelligenceService
 * (application layer) assigns the durable id (M18), same pattern as
 * RecommendationCandidate -> Recommendation.
 */
export interface DecisionReportDraft {
  readonly campaignId: string;
  /** Null when no strategy produced any recommendation — a valid, confident "no action needed". */
  readonly finalRecommendation: Recommendation | null;
  /** 0..1 — how dominant the final recommendation was over its closest competitor. */
  readonly confidenceScore: number;
  /** WHY this recommendation, in business terms — category weight, competing alternatives. */
  readonly businessJustification: string;
  /** WHAT to do and why, in plain language, suitable for showing directly to the user. */
  readonly explanation: string;
  readonly supportingEvidence: ReadonlyArray<EvidenceEntry>;
  readonly conflicts: ReadonlyArray<ConflictGroup>;
}

/**
 * The Decision Intelligence Engine's output: one coherent, explainable execution decision per
 * campaign, synthesized from every recommendation the Recommendation Engine produced. Advisory
 * only — nothing about a DecisionReport causes any execution to happen.
 */
export interface DecisionReport extends DecisionReportDraft {
  /** Assigned once, by DecisionIntelligenceService, the moment the draft is produced (M18). */
  readonly id: string;
  /** The pipeline run this decision belongs to — carried forward from the RECOMMENDATION_GENERATED stage so every downstream stage (Planning, Orchestration, ...) can keep recording under the same correlation id (M18). */
  readonly correlationId: string;
  readonly userId: string;
}
