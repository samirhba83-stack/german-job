import { Inject, Injectable } from '@nestjs/common';
import { clamp01 } from '../../../../shared/domain';
import { Recommendation, RecommendationCategory } from '../../../recommendations/domain/recommendation';
import { ConflictGroup, DecisionReportDraft, EvidenceEntry } from '../decision-report';
import { DecisionAggregationInput, DecisionAggregationStrategy } from '../ports/decision-aggregation-strategy.port';
import { DecisionIntelligenceConfig, DECISION_CONFIG } from '../decision-config';

interface ScoredRecommendation {
  readonly recommendation: Recommendation;
  readonly resolvedPriority: number;
}

/**
 * Default DECISION_AGGREGATION_STRATEGY binding.
 *
 * Aggregation: groups every recommendation by category — any category with more than one
 * candidate is a structural conflict (the engine can only surface one final action per decision
 * axis; see ConflictGroup). Priority: `resolvedPriority = expectedImpactScore * categoryWeight`,
 * weights coming entirely from injected config — never hardcoded here. Resolution: the highest
 * resolvedPriority across ALL categories becomes the final recommendation. Confidence: a
 * dominance ratio between the winner and its closest competitor (`winner / (winner + runnerUp)`)
 * — 1.0 when there is no competition, trending toward 0.5 as the top two candidates become
 * equally compelling. Ranking is fully deterministic: ties are broken by category, then
 * reasonCode, then producedBy, in that fixed order — never insertion order.
 */
@Injectable()
export class WeightedPriorityDecisionStrategy implements DecisionAggregationStrategy {
  constructor(@Inject(DECISION_CONFIG) private readonly config: DecisionIntelligenceConfig) {}

  aggregate(input: DecisionAggregationInput): DecisionReportDraft {
    const { campaignId, recommendations } = input;

    if (recommendations.length === 0) {
      return {
        campaignId,
        finalRecommendation: null,
        confidenceScore: 1,
        businessJustification: 'No recommendations were produced by any registered strategy.',
        explanation: 'No action is recommended; execution can proceed according to the current plan.',
        supportingEvidence: [],
        conflicts: [],
      };
    }

    const ranked = this.rank(recommendations.map((recommendation) => this.score(recommendation)));
    const [winner, runnerUp] = ranked;
    const conflicts = this.detectConflicts(recommendations);

    return {
      campaignId,
      finalRecommendation: winner.recommendation,
      confidenceScore: this.computeConfidence(winner.resolvedPriority, runnerUp?.resolvedPriority ?? null),
      businessJustification: this.buildJustification(winner, runnerUp, conflicts),
      explanation:
        `${winner.recommendation.explanation} This was selected as the highest-priority action ` +
        `(resolved priority ${winner.resolvedPriority.toFixed(2)}) among ${recommendations.length} ` +
        `recommendation(s) considered for this campaign.`,
      supportingEvidence: this.buildEvidence(ranked, winner),
      conflicts,
    };
  }

  private score(recommendation: Recommendation): ScoredRecommendation {
    return {
      recommendation,
      resolvedPriority: recommendation.expectedImpactScore * this.config.categoryWeights[recommendation.category],
    };
  }

  private rank(scored: ScoredRecommendation[]): ScoredRecommendation[] {
    return [...scored].sort((a, b) => {
      if (a.resolvedPriority !== b.resolvedPriority) {
        return b.resolvedPriority - a.resolvedPriority;
      }
      const a0 = a.recommendation;
      const b0 = b.recommendation;
      return (
        a0.category.localeCompare(b0.category) ||
        a0.reasonCode.localeCompare(b0.reasonCode) ||
        a0.producedBy.localeCompare(b0.producedBy)
      );
    });
  }

  private detectConflicts(recommendations: ReadonlyArray<Recommendation>): ConflictGroup[] {
    const byCategory = new Map<RecommendationCategory, Recommendation[]>();

    for (const recommendation of recommendations) {
      const bucket = byCategory.get(recommendation.category) ?? [];
      bucket.push(recommendation);
      byCategory.set(recommendation.category, bucket);
    }

    const conflicts: ConflictGroup[] = [];
    for (const [category, candidates] of byCategory) {
      if (candidates.length > 1) {
        conflicts.push({ category, candidates });
      }
    }

    return conflicts.sort((a, b) => a.category.localeCompare(b.category));
  }

  private computeConfidence(winnerPriority: number, runnerUpPriority: number | null): number {
    if (runnerUpPriority === null || winnerPriority + runnerUpPriority === 0) {
      return 1;
    }
    return clamp01(winnerPriority / (winnerPriority + runnerUpPriority));
  }

  private buildEvidence(ranked: ScoredRecommendation[], winner: ScoredRecommendation): EvidenceEntry[] {
    return ranked.map((entry) => ({
      recommendation: entry.recommendation,
      resolvedPriority: entry.resolvedPriority,
      selected: entry === winner,
    }));
  }

  private buildJustification(
    winner: ScoredRecommendation,
    runnerUp: ScoredRecommendation | undefined,
    conflicts: ConflictGroup[],
  ): string {
    const weight = this.config.categoryWeights[winner.recommendation.category];
    const categoryNote = `Category '${winner.recommendation.category}' carries a business weight of ${weight}.`;
    const conflictNote =
      conflicts.length > 0
        ? ` ${conflicts.length} categor${conflicts.length === 1 ? 'y has' : 'ies have'} multiple competing ` +
          'recommendations; the highest resolved-priority recommendation overall was selected.'
        : ' No other recommendation shared its category.';
    const comparisonNote = runnerUp
      ? ` Runner-up was "${runnerUp.recommendation.title}" (resolved priority ${runnerUp.resolvedPriority.toFixed(2)}).`
      : '';

    return (
      `Selected based on expected impact score (${winner.recommendation.expectedImpactScore.toFixed(2)}) weighted ` +
      `by configured business priority for its category. ${categoryNote}${conflictNote}${comparisonNote}`
    );
  }
}
