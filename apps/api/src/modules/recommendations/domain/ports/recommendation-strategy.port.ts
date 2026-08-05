import { RecommendationCandidate } from '../recommendation';
import { RecommendationContext } from '../recommendation-context';

export const RECOMMENDATION_STRATEGIES = Symbol('RECOMMENDATION_STRATEGIES');

/**
 * The Recommendation Engine's core extension point. Each strategy analyzes one campaign's full
 * context (execution plan, campaign state, candidate/company profile, historical outcomes) and
 * returns zero or more recommendations — pure, synchronous, and side-effect-free. A future AI
 * model becomes a new RecommendationStrategy implementation bound to RECOMMENDATION_STRATEGIES
 * via DI; RecommendationEngineService iterates whatever strategies are registered and never
 * needs to change to add, remove, or replace one.
 */
export interface RecommendationStrategy {
  /** Identifies this strategy in each Recommendation's `producedBy` field. */
  readonly kind: string;
  evaluate(context: RecommendationContext): RecommendationCandidate[];
}
