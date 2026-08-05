import { Inject, Injectable } from '@nestjs/common';
import { clamp01 } from '../../../../shared/domain';
import { RecommendationCandidate } from '../recommendation';
import { RecommendationContext } from '../recommendation-context';
import { RecommendationStrategy } from '../ports/recommendation-strategy.port';
import { RecommendationConfig, RECOMMENDATION_CONFIG } from '../recommendation-config';

/**
 * Default recommendation strategy: flags campaigns whose Dispatcher-computed risk score is
 * elevated, even when not yet high enough for Inbox Protection to refuse execution outright.
 * Turns the Dispatcher's own risk arithmetic (Phase 4 M4) into an actionable, advisory
 * suggestion — this strategy never touches execution, only reads `executionPlan.riskScore`.
 */
@Injectable()
export class RiskMitigationRecommendationStrategy implements RecommendationStrategy {
  readonly kind = 'RISK_MITIGATION';

  constructor(@Inject(RECOMMENDATION_CONFIG) private readonly config: RecommendationConfig) {}

  evaluate(context: RecommendationContext): RecommendationCandidate[] {
    const { riskScore } = context.executionPlan;
    const { elevatedRiskThreshold, expectedImpactWeight } = this.config.riskMitigation;

    if (riskScore < elevatedRiskThreshold) {
      return [];
    }

    return [
      {
        campaignId: context.campaign.id,
        category: 'RISK',
        title: 'Reduce batch size or increase spacing between sends',
        explanation:
          `Current risk score is ${riskScore.toFixed(2)}, at or above the ${elevatedRiskThreshold} threshold for ` +
          'elevated spam/deliverability risk. Lowering batch size or increasing the delay between sends reduces ' +
          'the chance of landing in spam and protects long-term sender reputation.',
        reasonCode: 'ELEVATED_RISK_SCORE',
        expectedImpactScore: clamp01(riskScore * expectedImpactWeight),
        producedBy: this.kind,
      },
    ];
  }
}
