import { Inject, Injectable } from '@nestjs/common';
import { clamp01 } from '../../../../shared/domain';
import { RecommendationCandidate } from '../recommendation';
import { RecommendationContext } from '../recommendation-context';
import { RecommendationStrategy } from '../ports/recommendation-strategy.port';
import { RecommendationConfig, RECOMMENDATION_CONFIG } from '../recommendation-config';

/**
 * Default recommendation strategy: flags a declining campaign health score as worth reviewing
 * before continuing execution. Abstains (returns no recommendation) when no health assessment
 * has been recorded yet — unlike the Dispatcher's AdaptiveBatchSizePolicy, which defaults missing
 * evidence to "good" because it must make a binary execution decision, this strategy only ever
 * advises, so it is safe (and more honest) to say nothing rather than assume.
 */
@Injectable()
export class CampaignHealthRecommendationStrategy implements RecommendationStrategy {
  readonly kind = 'CAMPAIGN_HEALTH';

  constructor(@Inject(RECOMMENDATION_CONFIG) private readonly config: RecommendationConfig) {}

  evaluate(context: RecommendationContext): RecommendationCandidate[] {
    const healthScore = context.campaign.health?.healthScore?.value;
    if (healthScore === undefined || healthScore === null) {
      return [];
    }

    const { lowHealthThreshold, expectedImpactWeight } = this.config.campaignHealth;
    if (healthScore >= lowHealthThreshold) {
      return [];
    }

    return [
      {
        campaignId: context.campaign.id,
        category: 'STRATEGY',
        title: 'Review campaign strategy',
        explanation:
          `Campaign health score is ${healthScore.toFixed(2)}, below the ${lowHealthThreshold} threshold. ` +
          'This indicates declining performance (replies, interviews, or delivery) — reviewing the targeting ' +
          'strategy, batch pacing, or goal before continuing execution may improve outcomes.',
        reasonCode: 'LOW_CAMPAIGN_HEALTH',
        expectedImpactScore: clamp01((1 - healthScore) * expectedImpactWeight),
        producedBy: this.kind,
      },
    ];
  }
}
