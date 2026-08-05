import { Injectable } from '@nestjs/common';
import { clamp01 } from '../../../../shared/domain';
import { RecommendationCandidate } from '../recommendation';
import { RecommendationContext } from '../recommendation-context';
import { RecommendationStrategy } from '../ports/recommendation-strategy.port';

/**
 * M26 — the missing baseline strategy the architecture audit found: the three strategies this
 * engine shipped with (M5) are all exception-only advisors — CampaignHealth abstains until a
 * health score is recorded and low, RiskMitigation abstains below its threshold, and
 * CompanyHistoricalSuccess abstains without a high-success history. An ordinary, healthy new
 * campaign with pending targets and no anomalies gets zero recommendations from all three, which
 * (verified live, not assumed) means DecisionIntelligence always reaches "no decision reached"
 * for it, ExecutionPlanning always builds an empty 0-step blueprint, and the entire pipeline has
 * nothing to execute — regardless of how correctly everything downstream is wired.
 *
 * `BATCH_SIZING` and `TIMING` are real, already-configured RecommendationCategory values
 * (DEFAULT_DECISION_CONFIG.categoryWeights already carries a weight for both) that no strategy
 * ever produced before this — this is their first real producer, not a new category invented for
 * this fix. Turns the Dispatcher's own routine `recommendedAction === 'DISPATCH_NOW'` signal
 * (Phase 4 M4 — computed for every eligible campaign, not just anomalous ones) into the baseline
 * recommendation DecisionIntelligence needs to ever produce a non-empty ExecutionBlueprint for
 * the common case. `RISK` (1.2) outweighs `BATCH_SIZING` (0.7) in the default category weights,
 * so a genuine RiskMitigation recommendation still wins the aggregation when both are present —
 * this strategy only fills the gap when nothing more urgent applies.
 */
@Injectable()
export class BaselineDispatchRecommendationStrategy implements RecommendationStrategy {
  readonly kind = 'BASELINE_DISPATCH';

  evaluate(context: RecommendationContext): RecommendationCandidate[] {
    const { executionPlan } = context;
    if (executionPlan.recommendedAction !== 'DISPATCH_NOW') {
      return [];
    }

    return [
      {
        campaignId: context.campaign.id,
        category: 'BATCH_SIZING',
        title: `Dispatch batch of up to ${executionPlan.recommendedBatchSize} target(s) now`,
        explanation:
          `The Dispatcher recommends proceeding now: no Inbox Protection blocker, delivery confidence ` +
          `${executionPlan.deliveryConfidenceScore.toFixed(2)}, recommended batch size ` +
          `${executionPlan.recommendedBatchSize}. No higher-priority risk, targeting, or strategy ` +
          'recommendation is competing for this cycle.',
        reasonCode: 'DISPATCH_READY',
        expectedImpactScore: clamp01(executionPlan.deliveryConfidenceScore),
        producedBy: this.kind,
      },
    ];
  }
}
