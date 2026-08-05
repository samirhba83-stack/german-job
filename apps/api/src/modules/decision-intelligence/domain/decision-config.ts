import { RecommendationCategory } from '../../recommendations/domain/recommendation';

export const DECISION_CONFIG = Symbol('DECISION_CONFIG');

/** Business-tunable weight per recommendation category, used to resolve priority when
 * recommendations compete. Provided via DI (DECISION_CONFIG) so business rules — e.g. "risk
 * always outweighs targeting suggestions" — are configuration, never a hardcoded comparison
 * buried in the aggregation algorithm. */
export interface DecisionIntelligenceConfig {
  readonly categoryWeights: Readonly<Record<RecommendationCategory, number>>;
}

export const DEFAULT_DECISION_CONFIG: DecisionIntelligenceConfig = {
  categoryWeights: {
    RISK: 1.2,
    STRATEGY: 1,
    TARGETING: 0.8,
    TIMING: 0.7,
    BATCH_SIZING: 0.7,
  },
};
