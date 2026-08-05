import { DeterministicTaskSelectionStrategy } from './deterministic-task-selection.strategy';
import { ExecutionTaskPipeline } from '../../../execution-orchestrator/domain/entities/execution-task-pipeline.entity';
import { BlueprintStepTaskGenerationStrategy } from '../../../execution-orchestrator/domain/strategies/blueprint-step-task-generation.strategy';
import { TransitiveDependentSkipPolicy } from '../../../execution-orchestrator/domain/strategies/transitive-dependent-skip.policy';
import { ExecutionBlueprint, ExecutionStep, ExecutionStepType } from '../../../execution-planning/domain/execution-blueprint';
import { DecisionReport } from '../../../decision-intelligence/domain/decision-report';
import { DEFAULT_TASK_SELECTION_CONFIG, TaskSelectionConfig } from '../task-selection-config';

const CAMPAIGN_ID = '123e4567-e89b-12d3-a456-426614174000';
const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildStep(id: string, dependsOn: string[] = [], type: ExecutionStepType = 'BATCH_EXECUTION'): ExecutionStep {
  return { id, type, phase: 0, title: `Step ${id}`, explanation: `Explanation for ${id}`, dependsOn };
}

function fakeDecisionReport(): DecisionReport {
  return {
    id: 'decision-1',
    campaignId: CAMPAIGN_ID,
    correlationId: 'correlation-1',
    userId: 'candidate-1',
    finalRecommendation: null,
    confidenceScore: 1,
    businessJustification: 'test',
    explanation: 'test',
    supportingEvidence: [],
    conflicts: [],
  };
}

function buildBlueprint(steps: ExecutionStep[]): ExecutionBlueprint {
  return {
    campaignId: CAMPAIGN_ID,
    steps,
    phases: [],
    batchSchedule: { batchCount: 0, entries: [] },
    executionWindows: [],
    retryPlan: { entries: [] },
    pacingStrategy: { interBatchDelayMs: 0, interStepDelayMs: 0 },
    cooldownPlan: { entries: [] },
    dependencyGraph: { edges: [] },
    explanation: 'test blueprint',
    basedOn: fakeDecisionReport(),
  };
}

function createPipeline(steps: ExecutionStep[]): ExecutionTaskPipeline {
  const blueprint = buildBlueprint(steps);
  const tasks = new BlueprintStepTaskGenerationStrategy().generate(blueprint, NOW);
  return ExecutionTaskPipeline.create(CAMPAIGN_ID, tasks, blueprint, new TransitiveDependentSkipPolicy(), NOW);
}

describe('DeterministicTaskSelectionStrategy', () => {
  const strategy = new DeterministicTaskSelectionStrategy(DEFAULT_TASK_SELECTION_CONFIG);

  describe('task selection', () => {
    it('selects the only READY task', () => {
      const pipeline = createPipeline([buildStep('a', [], 'PREPARATION')]);

      const decision = strategy.select(pipeline);

      expect(decision.campaignId).toBe(CAMPAIGN_ID);
      expect(decision.selectedTaskId).toBe('a');
      expect(decision.reasonCode).toBe('SELECTED_BY_PRIORITY');
      expect(decision.candidates).toEqual([{ taskId: 'a', rank: 1, explanation: expect.any(String) }]);
      expect(decision.correlationId).toBe('correlation-1');
      expect(decision.userId).toBe('candidate-1');
    });
  });

  describe('ordering', () => {
    it('picks the higher-weighted type when multiple tasks become READY simultaneously', () => {
      const pipeline = createPipeline([
        buildStep('prep', [], 'PREPARATION'),
        buildStep('batch', ['prep'], 'BATCH_EXECUTION'),
        buildStep('health', ['prep'], 'HEALTH_CHECKPOINT'),
      ]);
      pipeline.startTask('prep', NOW);
      pipeline.completeTask('prep', NOW); // both batch and health become READY together

      const decision = strategy.select(pipeline);

      expect(decision.selectedTaskId).toBe('health'); // HEALTH_CHECKPOINT(4) > BATCH_EXECUTION(3)
      expect(decision.candidates.map((c) => c.taskId)).toEqual(['health', 'batch']);
    });

    it('breaks a same-type tie by blueprint position', () => {
      const pipeline = createPipeline([
        buildStep('prep', [], 'PREPARATION'),
        buildStep('batch-2', ['prep'], 'BATCH_EXECUTION'),
        buildStep('batch-1', ['prep'], 'BATCH_EXECUTION'),
      ]);
      pipeline.startTask('prep', NOW);
      pipeline.completeTask('prep', NOW);

      const decision = strategy.select(pipeline);

      // 'batch-2' appears earlier in the blueprint/task array than 'batch-1', despite the name
      expect(decision.selectedTaskId).toBe('batch-2');
    });
  });

  describe('dependency completion', () => {
    it('never selects a task whose dependencies are not yet satisfied', () => {
      const pipeline = createPipeline([buildStep('a', [], 'PREPARATION'), buildStep('b', ['a'], 'BATCH_EXECUTION')]);

      const decision = strategy.select(pipeline);

      expect(decision.selectedTaskId).toBe('a');
      expect(decision.candidates.map((c) => c.taskId)).not.toContain('b');
    });
  });

  describe('explainability', () => {
    it('includes task id, type, and configured weight in the explanation', () => {
      const pipeline = createPipeline([buildStep('a', [], 'PREPARATION')]);

      const decision = strategy.select(pipeline);

      expect(decision.explanation).toContain('"a"');
      expect(decision.explanation).toContain('PREPARATION');
      expect(decision.explanation).toContain('5'); // configured PREPARATION weight
    });
  });

  describe('determinism', () => {
    it('produces an identical decision for repeated calls on the same pipeline', () => {
      const pipeline = createPipeline([
        buildStep('prep', [], 'PREPARATION'),
        buildStep('batch', ['prep'], 'BATCH_EXECUTION'),
        buildStep('health', ['prep'], 'HEALTH_CHECKPOINT'),
      ]);
      pipeline.startTask('prep', NOW);
      pipeline.completeTask('prep', NOW);

      const first = strategy.select(pipeline);
      const second = strategy.select(pipeline);

      expect(first).toEqual(second);
    });

    it('never mutates the pipeline', () => {
      const pipeline = createPipeline([buildStep('a', [], 'PREPARATION')]);

      strategy.select(pipeline);

      expect(pipeline.findTask('a')!.status).toBe('READY'); // unchanged — selection never starts anything
    });
  });

  describe('edge cases', () => {
    it('returns PIPELINE_NOT_ACTIVE for a FINISHED (empty) pipeline', () => {
      const pipeline = createPipeline([]);

      const decision = strategy.select(pipeline);

      expect(decision.selectedTaskId).toBeNull();
      expect(decision.reasonCode).toBe('PIPELINE_NOT_ACTIVE');
    });

    it('returns PIPELINE_NOT_ACTIVE for a PAUSED pipeline even with a READY task present', () => {
      const pipeline = createPipeline([buildStep('a', [], 'PREPARATION')]);
      pipeline.pause(NOW);

      const decision = strategy.select(pipeline);

      expect(decision.selectedTaskId).toBeNull();
      expect(decision.reasonCode).toBe('PIPELINE_NOT_ACTIVE');
    });

    it('returns PIPELINE_NOT_ACTIVE for a CANCELLED pipeline', () => {
      const pipeline = createPipeline([buildStep('a', [], 'PREPARATION')]);
      pipeline.cancel(NOW);

      const decision = strategy.select(pipeline);

      expect(decision.reasonCode).toBe('PIPELINE_NOT_ACTIVE');
    });

    it('returns NO_READY_TASKS for an ACTIVE pipeline whose only task is already RUNNING', () => {
      const pipeline = createPipeline([buildStep('a', [], 'PREPARATION'), buildStep('b', ['a'])]);
      pipeline.startTask('a', NOW);

      const decision = strategy.select(pipeline);

      expect(pipeline.status).toBe('ACTIVE');
      expect(decision.selectedTaskId).toBeNull();
      expect(decision.reasonCode).toBe('NO_READY_TASKS');
    });
  });

  describe('configuration-driven behavior', () => {
    it('flips the winner when type weights are reconfigured', () => {
      const pipeline = createPipeline([
        buildStep('prep', [], 'PREPARATION'),
        buildStep('batch', ['prep'], 'BATCH_EXECUTION'),
        buildStep('health', ['prep'], 'HEALTH_CHECKPOINT'),
      ]);
      pipeline.startTask('prep', NOW);
      pipeline.completeTask('prep', NOW);

      const invertedConfig: TaskSelectionConfig = {
        typeWeights: { ...DEFAULT_TASK_SELECTION_CONFIG.typeWeights, BATCH_EXECUTION: 100 },
      };
      const invertedStrategy = new DeterministicTaskSelectionStrategy(invertedConfig);

      const decision = invertedStrategy.select(pipeline);

      expect(decision.selectedTaskId).toBe('batch');
    });
  });
});
