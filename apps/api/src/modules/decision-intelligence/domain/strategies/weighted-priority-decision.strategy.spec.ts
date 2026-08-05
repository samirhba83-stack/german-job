import { WeightedPriorityDecisionStrategy } from './weighted-priority-decision.strategy';
import { Recommendation } from '../../../recommendations/domain/recommendation';
import { DecisionIntelligenceConfig, DEFAULT_DECISION_CONFIG } from '../decision-config';

const CAMPAIGN_ID = '123e4567-e89b-12d3-a456-426614174000';

let recommendationCounter = 0;

function buildRecommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  recommendationCounter += 1;
  return {
    id: `recommendation-${recommendationCounter}`,
    campaignId: CAMPAIGN_ID,
    category: 'RISK',
    title: 'Test recommendation',
    explanation: 'Test explanation.',
    reasonCode: 'TEST_REASON',
    expectedImpactScore: 0.5,
    producedBy: 'TEST_STRATEGY',
    ...overrides,
  };
}

describe('WeightedPriorityDecisionStrategy', () => {
  const strategy = new WeightedPriorityDecisionStrategy(DEFAULT_DECISION_CONFIG);

  describe('no recommendations', () => {
    it('reports a confident no-action decision', () => {
      const report = strategy.aggregate({ campaignId: CAMPAIGN_ID, recommendations: [] });

      expect(report.finalRecommendation).toBeNull();
      expect(report.confidenceScore).toBe(1);
      expect(report.supportingEvidence).toEqual([]);
      expect(report.conflicts).toEqual([]);
      expect(report.explanation).toContain('No action');
    });
  });

  describe('single recommendation', () => {
    it('selects it outright with full confidence and no conflicts', () => {
      const recommendation = buildRecommendation({ expectedImpactScore: 0.5 });

      const report = strategy.aggregate({ campaignId: CAMPAIGN_ID, recommendations: [recommendation] });

      expect(report.finalRecommendation).toBe(recommendation);
      expect(report.confidenceScore).toBe(1);
      expect(report.conflicts).toEqual([]);
      expect(report.supportingEvidence).toEqual([{ recommendation, resolvedPriority: 0.5 * 1.2, selected: true }]);
      expect(report.explanation).toContain(recommendation.explanation);
    });
  });

  describe('recommendation conflicts', () => {
    it('groups same-category recommendations as a conflict', () => {
      const a = buildRecommendation({ category: 'STRATEGY', reasonCode: 'A_REASON', expectedImpactScore: 0.6 });
      const b = buildRecommendation({ category: 'STRATEGY', reasonCode: 'B_REASON', expectedImpactScore: 0.4 });

      const report = strategy.aggregate({ campaignId: CAMPAIGN_ID, recommendations: [a, b] });

      expect(report.conflicts).toHaveLength(1);
      expect(report.conflicts[0].category).toBe('STRATEGY');
      expect(report.conflicts[0].candidates).toEqual(expect.arrayContaining([a, b]));
    });

    it('does not report a conflict when categories differ', () => {
      const a = buildRecommendation({ category: 'RISK' });
      const b = buildRecommendation({ category: 'TARGETING' });

      const report = strategy.aggregate({ campaignId: CAMPAIGN_ID, recommendations: [a, b] });

      expect(report.conflicts).toEqual([]);
    });
  });

  describe('priority resolution', () => {
    it('picks the higher resolved-priority recommendation as the winner', () => {
      // RISK weight 1.2, TARGETING weight 0.8 (default config)
      const highRisk = buildRecommendation({ category: 'RISK', reasonCode: 'RISK_REASON', expectedImpactScore: 0.5 }); // 0.6
      const highTargeting = buildRecommendation({ category: 'TARGETING', reasonCode: 'TARGETING_REASON', expectedImpactScore: 0.5 }); // 0.4

      const report = strategy.aggregate({ campaignId: CAMPAIGN_ID, recommendations: [highRisk, highTargeting] });

      expect(report.finalRecommendation).toBe(highRisk);
    });

    it('computes confidence as the dominance ratio between winner and runner-up', () => {
      const winner = buildRecommendation({ category: 'STRATEGY', reasonCode: 'A', expectedImpactScore: 0.6 }); // *1 = 0.6
      const runnerUp = buildRecommendation({ category: 'TIMING', reasonCode: 'B', expectedImpactScore: 0.3 / 0.7 }); // *0.7 = 0.3

      const report = strategy.aggregate({ campaignId: CAMPAIGN_ID, recommendations: [winner, runnerUp] });

      expect(report.confidenceScore).toBeCloseTo(0.6 / 0.9, 5);
    });
  });

  describe('deterministic ranking', () => {
    it('breaks exact ties by category, then reasonCode, then producedBy, not insertion order', () => {
      const second = buildRecommendation({ category: 'RISK', reasonCode: 'B_REASON', producedBy: 'STRATEGY_X', expectedImpactScore: 0.5 });
      const first = buildRecommendation({ category: 'RISK', reasonCode: 'A_REASON', producedBy: 'STRATEGY_Y', expectedImpactScore: 0.5 });

      // Inserted with the "loser" first to prove the tiebreak, not array order, decides the winner.
      const report = strategy.aggregate({ campaignId: CAMPAIGN_ID, recommendations: [second, first] });

      expect(report.finalRecommendation).toBe(first);
    });

    it('produces the same winner regardless of input order', () => {
      const a = buildRecommendation({ category: 'RISK', reasonCode: 'A', expectedImpactScore: 0.9 });
      const b = buildRecommendation({ category: 'TARGETING', reasonCode: 'B', expectedImpactScore: 0.1 });

      const forward = strategy.aggregate({ campaignId: CAMPAIGN_ID, recommendations: [a, b] });
      const reversed = strategy.aggregate({ campaignId: CAMPAIGN_ID, recommendations: [b, a] });

      expect(forward.finalRecommendation).toBe(reversed.finalRecommendation);
      expect(forward.finalRecommendation).toBe(a);
    });
  });

  describe('explainability', () => {
    it('includes category weight, resolved priority, and runner-up in the business justification', () => {
      const winner = buildRecommendation({ category: 'RISK', title: 'Winner title', expectedImpactScore: 0.5 });
      const runnerUp = buildRecommendation({ category: 'TIMING', title: 'Runner-up title', expectedImpactScore: 0.5 });

      const report = strategy.aggregate({ campaignId: CAMPAIGN_ID, recommendations: [winner, runnerUp] });

      expect(report.businessJustification).toContain("'RISK'");
      expect(report.businessJustification).toContain('1.2');
      expect(report.businessJustification).toContain('Runner-up title');
    });

    it('carries every considered recommendation as traceable supporting evidence', () => {
      const a = buildRecommendation({ category: 'RISK', reasonCode: 'A' });
      const b = buildRecommendation({ category: 'TARGETING', reasonCode: 'B' });
      const c = buildRecommendation({ category: 'TIMING', reasonCode: 'C' });

      const report = strategy.aggregate({ campaignId: CAMPAIGN_ID, recommendations: [a, b, c] });

      expect(report.supportingEvidence).toHaveLength(3);
      expect(report.supportingEvidence.filter((entry) => entry.selected)).toHaveLength(1);
      expect(new Set(report.supportingEvidence.map((entry) => entry.recommendation))).toEqual(new Set([a, b, c]));
    });
  });

  describe('configuration-driven behavior', () => {
    it('flips the winner when category weights are reconfigured', () => {
      const risk = buildRecommendation({ category: 'RISK', reasonCode: 'RISK_REASON', expectedImpactScore: 0.5 });
      const targeting = buildRecommendation({ category: 'TARGETING', reasonCode: 'TARGETING_REASON', expectedImpactScore: 0.5 });

      const defaultReport = strategy.aggregate({ campaignId: CAMPAIGN_ID, recommendations: [risk, targeting] });
      expect(defaultReport.finalRecommendation).toBe(risk); // RISK (1.2) > TARGETING (0.8) by default

      const invertedConfig: DecisionIntelligenceConfig = {
        categoryWeights: { ...DEFAULT_DECISION_CONFIG.categoryWeights, RISK: 0.1, TARGETING: 2 },
      };
      const invertedStrategy = new WeightedPriorityDecisionStrategy(invertedConfig);
      const invertedReport = invertedStrategy.aggregate({ campaignId: CAMPAIGN_ID, recommendations: [risk, targeting] });

      expect(invertedReport.finalRecommendation).toBe(targeting);
    });

    it('is unaffected by categories not present in the recommendation set', () => {
      const custom: DecisionIntelligenceConfig = {
        categoryWeights: { ...DEFAULT_DECISION_CONFIG.categoryWeights, BATCH_SIZING: 999 },
      };
      const recommendation = buildRecommendation({ category: 'RISK', expectedImpactScore: 0.5 });

      const report = new WeightedPriorityDecisionStrategy(custom).aggregate({
        campaignId: CAMPAIGN_ID,
        recommendations: [recommendation],
      });

      expect(report.finalRecommendation).toBe(recommendation);
    });
  });
});
