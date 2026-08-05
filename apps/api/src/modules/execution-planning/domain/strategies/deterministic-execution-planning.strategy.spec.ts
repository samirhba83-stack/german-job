import { DeterministicExecutionPlanningStrategy } from './deterministic-execution-planning.strategy';
import { Recommendation } from '../../../recommendations/domain/recommendation';
import { DecisionReport, EvidenceEntry } from '../../../decision-intelligence/domain/decision-report';
import { ExecutionPlanningConfig, DEFAULT_EXECUTION_PLANNING_CONFIG } from '../execution-planning-config';

const CAMPAIGN_ID = '123e4567-e89b-12d3-a456-426614174000';

function buildRecommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: 'recommendation-1',
    campaignId: CAMPAIGN_ID,
    category: 'RISK',
    title: 'Reduce batch size',
    explanation: 'Risk is elevated.',
    reasonCode: 'ELEVATED_RISK_SCORE',
    expectedImpactScore: 0.6,
    producedBy: 'RISK_MITIGATION',
    ...overrides,
  };
}

function buildDecisionReport(overrides: Partial<DecisionReport> = {}): DecisionReport {
  const recommendation = overrides.finalRecommendation !== undefined ? overrides.finalRecommendation : buildRecommendation();
  const evidence: EvidenceEntry[] = recommendation ? [{ recommendation, resolvedPriority: 0.72, selected: true }] : [];

  return {
    id: 'decision-1',
    campaignId: CAMPAIGN_ID,
    correlationId: 'correlation-1',
    userId: 'candidate-1',
    finalRecommendation: recommendation,
    confidenceScore: 0.8,
    businessJustification: 'Selected based on expected impact.',
    explanation: 'Reduce batch size to lower risk.',
    supportingEvidence: evidence,
    conflicts: [],
    ...overrides,
  };
}

describe('DeterministicExecutionPlanningStrategy', () => {
  const strategy = new DeterministicExecutionPlanningStrategy(DEFAULT_EXECUTION_PLANNING_CONFIG);

  describe('execution planning', () => {
    it('produces an empty blueprint when the decision report has no final recommendation', () => {
      const report = buildDecisionReport({ finalRecommendation: null, supportingEvidence: [] });

      const blueprint = strategy.plan(report);

      expect(blueprint.campaignId).toBe(CAMPAIGN_ID);
      expect(blueprint.steps).toEqual([]);
      expect(blueprint.phases).toEqual([]);
      expect(blueprint.batchSchedule).toEqual({ batchCount: 0, entries: [] });
      expect(blueprint.executionWindows).toEqual([]);
      expect(blueprint.retryPlan.entries).toEqual([]);
      expect(blueprint.cooldownPlan.entries).toEqual([]);
      expect(blueprint.dependencyGraph.edges).toEqual([]);
      expect(blueprint.basedOn).toBe(report);
    });

    it('builds the correct step composition for the base batch count', () => {
      const report = buildDecisionReport({ confidenceScore: 0.8 }); // >= lowConfidenceThreshold(0.6) -> baseBatchCount(3)

      const blueprint = strategy.plan(report);

      const byType = (type: string) => blueprint.steps.filter((step) => step.type === type);
      expect(byType('PREPARATION')).toHaveLength(1);
      expect(byType('BATCH_EXECUTION')).toHaveLength(3);
      expect(byType('HEALTH_CHECKPOINT')).toHaveLength(3);
      expect(byType('COOLDOWN')).toHaveLength(2); // no cooldown after the final batch
      expect(byType('COMPLETION')).toHaveLength(1);
      expect(blueprint.steps).toHaveLength(10);
      expect(blueprint.batchSchedule.batchCount).toBe(3);
    });

    it('carries the full DecisionReport for traceability', () => {
      const report = buildDecisionReport();

      const blueprint = strategy.plan(report);

      expect(blueprint.basedOn).toBe(report);
    });
  });

  describe('dependency ordering', () => {
    it('produces one edge per non-preparation step, with no forward references', () => {
      const blueprint = strategy.plan(buildDecisionReport());

      const stepIndexById = new Map(blueprint.steps.map((step, index) => [step.id, index]));
      expect(blueprint.dependencyGraph.edges).toHaveLength(blueprint.steps.length - 1); // every step but PREPARATION has exactly one dependency

      for (const edge of blueprint.dependencyGraph.edges) {
        const fromIndex = stepIndexById.get(edge.fromStepId);
        const toIndex = stepIndexById.get(edge.toStepId);
        expect(fromIndex).toBeDefined();
        expect(toIndex).toBeDefined();
        expect(fromIndex!).toBeLessThan(toIndex!); // dependency always precedes dependent step
      }
    });

    it('chains batch -> health check -> cooldown -> next batch correctly', () => {
      const blueprint = strategy.plan(buildDecisionReport());
      const edges = blueprint.dependencyGraph.edges;

      expect(edges).toContainEqual({ fromStepId: 'step-preparation', toStepId: 'step-batch-1' });
      expect(edges).toContainEqual({ fromStepId: 'step-batch-1', toStepId: 'step-health-check-1' });
      expect(edges).toContainEqual({ fromStepId: 'step-health-check-1', toStepId: 'step-cooldown-1' });
      expect(edges).toContainEqual({ fromStepId: 'step-cooldown-1', toStepId: 'step-batch-2' });
      // the final batch has no cooldown; completion depends directly on its health check
      expect(edges).toContainEqual({ fromStepId: 'step-health-check-3', toStepId: 'step-completion' });
    });
  });

  describe('pacing calculation', () => {
    it('computes batch offsets from inter-batch delay and (risk-scaled) cooldown duration', () => {
      const report = buildDecisionReport({ finalRecommendation: buildRecommendation({ category: 'RISK' }) });

      const blueprint = strategy.plan(report);

      // interStepDelayMs=300000, interBatchDelayMs=1800000, cooldown(RISK)=3600000*2=7200000
      expect(blueprint.batchSchedule.entries).toEqual([
        { batchNumber: 1, stepId: 'step-batch-1', relativeStartOffsetMs: 300_000 },
        { batchNumber: 2, stepId: 'step-batch-2', relativeStartOffsetMs: 300_000 + 1_800_000 + 7_200_000 },
        { batchNumber: 3, stepId: 'step-batch-3', relativeStartOffsetMs: 300_000 + 2 * (1_800_000 + 7_200_000) },
      ]);
    });

    it('uses the unscaled cooldown duration for a non-RISK category', () => {
      const report = buildDecisionReport({
        finalRecommendation: buildRecommendation({ category: 'STRATEGY' }),
      });

      const blueprint = strategy.plan(report);

      // cooldown(STRATEGY)=3600000 (no risk multiplier)
      expect(blueprint.batchSchedule.entries[1].relativeStartOffsetMs).toBe(300_000 + 1_800_000 + 3_600_000);
      expect(blueprint.cooldownPlan.entries[0].durationMs).toBe(3_600_000);
      expect(blueprint.cooldownPlan.entries[0].reason).toContain('Standard cooldown');
    });

    it('produces a geometric retry backoff per batch step', () => {
      const blueprint = strategy.plan(buildDecisionReport());

      for (const entry of blueprint.retryPlan.entries) {
        expect(entry.maxAttempts).toBe(3);
        expect(entry.backoffMs).toEqual([900_000, 1_800_000, 3_600_000]); // 15min, 30min (x2), 60min (x2)
      }
    });

    it('exposes pacing strategy directly from configuration', () => {
      const blueprint = strategy.plan(buildDecisionReport());

      expect(blueprint.pacingStrategy).toEqual({ interBatchDelayMs: 1_800_000, interStepDelayMs: 300_000 });
    });
  });

  describe('execution sequencing', () => {
    it('orders phases sequentially starting at 0', () => {
      const blueprint = strategy.plan(buildDecisionReport());

      expect(blueprint.phases.map((phase) => phase.index)).toEqual([0, 1, 2, 3, 4]);
      expect(blueprint.phases[0].name).toBe('Preparation');
      expect(blueprint.phases[blueprint.phases.length - 1].name).toBe('Completion');
    });

    it('produces one execution window per phase with monotonically non-decreasing start times', () => {
      const blueprint = strategy.plan(buildDecisionReport());

      expect(blueprint.executionWindows).toHaveLength(blueprint.phases.length);
      expect(blueprint.executionWindows[0].relativeStartMs).toBe(0);

      for (let i = 1; i < blueprint.executionWindows.length; i += 1) {
        expect(blueprint.executionWindows[i].relativeStartMs).toBeGreaterThanOrEqual(
          blueprint.executionWindows[i - 1].relativeStartMs,
        );
      }
    });
  });

  describe('determinism', () => {
    it('produces byte-identical output for the same input, called twice', () => {
      const report = buildDecisionReport();

      const first = strategy.plan(report);
      const second = strategy.plan(report);

      expect(first).toEqual(second);
    });

    it('is unaffected by call order across different inputs (no shared mutable state)', () => {
      const riskReport = buildDecisionReport({ finalRecommendation: buildRecommendation({ category: 'RISK' }) });
      const strategyReport = buildDecisionReport({ finalRecommendation: buildRecommendation({ category: 'STRATEGY' }) });

      const a = strategy.plan(riskReport);
      strategy.plan(strategyReport);
      const b = strategy.plan(riskReport);

      expect(a).toEqual(b);
    });
  });

  describe('explainability', () => {
    it('includes recommendation title, category, confidence, batch count, and evidence count in the explanation', () => {
      const report = buildDecisionReport({ confidenceScore: 0.8 });

      const blueprint = strategy.plan(report);

      expect(blueprint.explanation).toContain('Reduce batch size');
      expect(blueprint.explanation).toContain('RISK');
      expect(blueprint.explanation).toContain('0.80');
      expect(blueprint.explanation).toContain('3 batch(es)');
      expect(blueprint.explanation).toContain('1 recommendation(s)');
    });

    it('mentions resolved conflicts when the decision report had any', () => {
      const recommendation = buildRecommendation();
      const report = buildDecisionReport({
        finalRecommendation: recommendation,
        conflicts: [{ category: 'RISK', candidates: [recommendation] }],
      });

      const blueprint = strategy.plan(report);

      expect(blueprint.explanation).toContain('resolving 1 conflict(s)');
    });
  });

  describe('configuration-driven behavior', () => {
    it('adds extra batches when confidence is below the configured low-confidence threshold', () => {
      const lowConfidenceReport = buildDecisionReport({ confidenceScore: 0.3 });

      const blueprint = strategy.plan(lowConfidenceReport);

      expect(blueprint.batchSchedule.batchCount).toBe(DEFAULT_EXECUTION_PLANNING_CONFIG.baseBatchCount + DEFAULT_EXECUTION_PLANNING_CONFIG.lowConfidenceExtraBatches);
    });

    it('changes batch count purely via config, without any code change', () => {
      const customConfig: ExecutionPlanningConfig = { ...DEFAULT_EXECUTION_PLANNING_CONFIG, baseBatchCount: 1 };
      const customStrategy = new DeterministicExecutionPlanningStrategy(customConfig);

      const blueprint = customStrategy.plan(buildDecisionReport({ confidenceScore: 0.9 }));

      expect(blueprint.batchSchedule.batchCount).toBe(1);
      expect(blueprint.steps.filter((step) => step.type === 'COOLDOWN')).toHaveLength(0); // single batch never cools down
    });

    it('changes cooldown risk scaling purely via config', () => {
      const customConfig: ExecutionPlanningConfig = { ...DEFAULT_EXECUTION_PLANNING_CONFIG, cooldownRiskMultiplier: 5 };
      const customStrategy = new DeterministicExecutionPlanningStrategy(customConfig);

      const blueprint = customStrategy.plan(buildDecisionReport({ finalRecommendation: buildRecommendation({ category: 'RISK' }) }));

      expect(blueprint.cooldownPlan.entries[0].durationMs).toBe(DEFAULT_EXECUTION_PLANNING_CONFIG.cooldownDurationMs * 5);
    });
  });
});
