import { Inject, Injectable } from '@nestjs/common';
import { clamp01 } from '../../../../shared/domain';
import { RecommendationCandidate } from '../recommendation';
import { RecommendationContext } from '../recommendation-context';
import { RecommendationStrategy } from '../ports/recommendation-strategy.port';
import { RecommendationConfig, RECOMMENDATION_CONFIG } from '../recommendation-config';

/**
 * Default recommendation strategy: surfaces companies with a strong historical success signal
 * (interviews/offers from past interactions) that the campaign hasn't applied to yet, suggesting
 * they be prioritized. Reads CampaignMemoryEntry.historicalSuccessScore — reserved since Phase 4
 * M1 ("nothing in the domain reads it yet") — this strategy is its first real consumer.
 */
@Injectable()
export class CompanyHistoricalSuccessRecommendationStrategy implements RecommendationStrategy {
  readonly kind = 'COMPANY_HISTORICAL_SUCCESS';

  constructor(@Inject(RECOMMENDATION_CONFIG) private readonly config: RecommendationConfig) {}

  evaluate(context: RecommendationContext): RecommendationCandidate[] {
    const { highSuccessThreshold, expectedImpactWeight } = this.config.companyHistoricalSuccess;
    const recommendations: RecommendationCandidate[] = [];

    for (const outcome of context.historicalOutcomes.values()) {
      if (outcome.alreadyApplied || outcome.historicalSuccessScoreValue === null) {
        continue;
      }
      if (outcome.historicalSuccessScoreValue < highSuccessThreshold) {
        continue;
      }

      recommendations.push({
        campaignId: context.campaign.id,
        category: 'TARGETING',
        title: `Prioritize company ${outcome.companyId}`,
        explanation:
          `This company has a historical success score of ${outcome.historicalSuccessScoreValue.toFixed(2)} ` +
          `(${outcome.interviewCount} interview(s), ${outcome.offerCount} offer(s) previously) and has not yet ` +
          'been applied to in this campaign — prioritizing it may improve interview and offer rates.',
        reasonCode: 'HIGH_HISTORICAL_SUCCESS',
        expectedImpactScore: clamp01(outcome.historicalSuccessScoreValue * expectedImpactWeight),
        producedBy: this.kind,
      });
    }

    return recommendations;
  }
}
