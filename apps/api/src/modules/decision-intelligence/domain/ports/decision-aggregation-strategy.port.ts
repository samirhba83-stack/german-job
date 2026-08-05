import { Recommendation } from '../../../recommendations/domain/recommendation';
import { DecisionReportDraft } from '../decision-report';

export const DECISION_AGGREGATION_STRATEGY = Symbol('DECISION_AGGREGATION_STRATEGY');

export interface DecisionAggregationInput {
  readonly campaignId: string;
  readonly recommendations: ReadonlyArray<Recommendation>;
}

/**
 * The Decision Intelligence Engine's core extension point. Takes every recommendation produced
 * for one campaign and synthesizes them into a single, explainable DecisionReport — pure,
 * synchronous, side-effect-free, deterministic. A future AI model becomes a new
 * DecisionAggregationStrategy implementation bound to DECISION_AGGREGATION_STRATEGY via DI;
 * DecisionIntelligenceService delegates to whatever is registered and never needs to change to
 * replace or complement the aggregation logic.
 */
export interface DecisionAggregationStrategy {
  aggregate(input: DecisionAggregationInput): DecisionReportDraft;
}
