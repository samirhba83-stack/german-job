import { ExecutionTaskPipeline } from './execution-task-pipeline.entity';
import { ExecutionTask } from './execution-task.entity';
import { InvalidPipelineStatusTransitionException } from '../exceptions/invalid-pipeline-status-transition.exception';
import { TaskNotFoundException } from '../exceptions/task-not-found.exception';
import { TransitiveDependentSkipPolicy } from '../strategies/transitive-dependent-skip.policy';
import { BlueprintStepTaskGenerationStrategy } from '../strategies/blueprint-step-task-generation.strategy';
import { FailureCascadePolicy } from '../ports/failure-cascade-policy.port';
import { ExecutionBlueprint, ExecutionStep } from '../../../execution-planning/domain/execution-blueprint';
import { DecisionReport } from '../../../decision-intelligence/domain/decision-report';

const CAMPAIGN_ID = '123e4567-e89b-12d3-a456-426614174000';
const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildStep(id: string, dependsOn: string[] = []): ExecutionStep {
  return { id, type: 'BATCH_EXECUTION', phase: 0, title: `Step ${id}`, explanation: `Explanation for ${id}`, dependsOn };
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
    dependencyGraph: { edges: steps.flatMap((step) => step.dependsOn.map((dep) => ({ fromStepId: dep, toStepId: step.id }))) },
    explanation: 'Test blueprint.',
    basedOn: fakeDecisionReport(),
  };
}

function createPipeline(steps: ExecutionStep[], policy: FailureCascadePolicy = new TransitiveDependentSkipPolicy()): { pipeline: ExecutionTaskPipeline; blueprint: ExecutionBlueprint } {
  const blueprint = buildBlueprint(steps);
  const tasks = new BlueprintStepTaskGenerationStrategy().generate(blueprint, NOW);
  return { pipeline: ExecutionTaskPipeline.create(CAMPAIGN_ID, tasks, blueprint, policy, NOW), blueprint };
}

function statusOf(pipeline: ExecutionTaskPipeline, taskId: string): string {
  return pipeline.findTask(taskId)!.status;
}

describe('ExecutionTaskPipeline', () => {
  describe('task generation / initial state', () => {
    it('starts ACTIVE with the first (no-dependency) task READY and the rest PENDING', () => {
      const { pipeline } = createPipeline([buildStep('a'), buildStep('b', ['a']), buildStep('c', ['b'])]);

      expect(pipeline.status).toBe('ACTIVE');
      expect(statusOf(pipeline, 'a')).toBe('READY');
      expect(statusOf(pipeline, 'b')).toBe('PENDING');
      expect(statusOf(pipeline, 'c')).toBe('PENDING');
    });

    it('starts FINISHED when the blueprint has no steps', () => {
      const { pipeline } = createPipeline([]);

      expect(pipeline.status).toBe('FINISHED');
      expect(pipeline.tasks).toEqual([]);
    });
  });

  describe('dependency resolution', () => {
    it('promotes a PENDING task to READY once every dependency completes (linear chain)', () => {
      const { pipeline } = createPipeline([buildStep('a'), buildStep('b', ['a']), buildStep('c', ['b'])]);

      pipeline.startTask('a', NOW);
      pipeline.completeTask('a', NOW);

      expect(statusOf(pipeline, 'b')).toBe('READY');
      expect(statusOf(pipeline, 'c')).toBe('PENDING'); // still blocked on b
    });

    it('requires ALL dependencies to complete before a fan-in task becomes ready', () => {
      const { pipeline } = createPipeline([buildStep('a'), buildStep('b'), buildStep('c', ['a', 'b'])]);

      pipeline.startTask('a', NOW);
      pipeline.completeTask('a', NOW);
      expect(statusOf(pipeline, 'c')).toBe('PENDING');

      pipeline.startTask('b', NOW);
      pipeline.completeTask('b', NOW);
      expect(statusOf(pipeline, 'c')).toBe('READY');
    });

    it('makes independent fan-out tasks ready in parallel', () => {
      const { pipeline } = createPipeline([buildStep('a'), buildStep('b', ['a']), buildStep('c', ['a'])]);

      pipeline.startTask('a', NOW);
      pipeline.completeTask('a', NOW);

      expect(statusOf(pipeline, 'b')).toBe('READY');
      expect(statusOf(pipeline, 'c')).toBe('READY');
      expect(pipeline.getReadyTasks().map((t) => t.id).sort()).toEqual(['b', 'c']);
    });
  });

  describe('state transitions', () => {
    it('follows READY -> RUNNING -> COMPLETED for a task with no dependents', () => {
      const { pipeline } = createPipeline([buildStep('a')]);

      pipeline.startTask('a', NOW);
      expect(statusOf(pipeline, 'a')).toBe('RUNNING');

      pipeline.completeTask('a', NOW);
      expect(statusOf(pipeline, 'a')).toBe('COMPLETED');
    });

    it('refuses to start a task that is not READY', () => {
      const { pipeline } = createPipeline([buildStep('a'), buildStep('b', ['a'])]);

      expect(() => pipeline.startTask('b', NOW)).toThrow();
    });

    it('throws TaskNotFoundException for an unknown task id', () => {
      const { pipeline } = createPipeline([buildStep('a')]);

      expect(() => pipeline.startTask('unknown', NOW)).toThrow(TaskNotFoundException);
    });

    it('cascades a failure to skip every transitive dependent', () => {
      const { pipeline } = createPipeline([buildStep('a'), buildStep('b', ['a']), buildStep('c', ['b'])]);

      pipeline.startTask('a', NOW);
      pipeline.failTask('a', 'boom', NOW);

      expect(statusOf(pipeline, 'a')).toBe('FAILED');
      expect(statusOf(pipeline, 'b')).toBe('SKIPPED');
      expect(statusOf(pipeline, 'c')).toBe('SKIPPED');
    });

    it('does not cascade a failure to an independent branch', () => {
      const { pipeline } = createPipeline([buildStep('a'), buildStep('b', ['a']), buildStep('independent')]);

      pipeline.startTask('a', NOW);
      pipeline.failTask('a', 'boom', NOW);

      expect(statusOf(pipeline, 'b')).toBe('SKIPPED');
      expect(statusOf(pipeline, 'independent')).toBe('READY'); // unaffected
    });

    it('transitions the pipeline to FINISHED once every task reaches a terminal status', () => {
      const { pipeline } = createPipeline([buildStep('a')]);

      pipeline.startTask('a', NOW);
      pipeline.completeTask('a', NOW);

      expect(pipeline.status).toBe('FINISHED');
    });
  });

  describe('pause and resume', () => {
    it('blocks starting new tasks while paused', () => {
      const { pipeline } = createPipeline([buildStep('a')]);

      pipeline.pause(NOW);

      expect(() => pipeline.startTask('a', NOW)).toThrow(InvalidPipelineStatusTransitionException);
    });

    it('still allows an already-running task to complete while paused', () => {
      const { pipeline } = createPipeline([buildStep('a'), buildStep('b', ['a'])]);

      pipeline.startTask('a', NOW);
      pipeline.pause(NOW);
      pipeline.completeTask('a', NOW); // in-flight work finishing, not "starting new work"

      expect(statusOf(pipeline, 'a')).toBe('COMPLETED');
      // readiness promotion itself is held back until resume
      expect(statusOf(pipeline, 'b')).toBe('PENDING');
    });

    it('resolves held-back readiness on resume', () => {
      const { pipeline } = createPipeline([buildStep('a'), buildStep('b', ['a'])]);

      pipeline.startTask('a', NOW);
      pipeline.pause(NOW);
      pipeline.completeTask('a', NOW);
      expect(statusOf(pipeline, 'b')).toBe('PENDING');

      pipeline.resume(NOW);

      expect(pipeline.status).toBe('ACTIVE');
      expect(statusOf(pipeline, 'b')).toBe('READY');
    });

    it('refuses to pause a pipeline that is not ACTIVE', () => {
      const { pipeline } = createPipeline([buildStep('a')]);
      pipeline.pause(NOW);

      expect(() => pipeline.pause(NOW)).toThrow(InvalidPipelineStatusTransitionException);
    });

    it('refuses to resume a pipeline that is not PAUSED', () => {
      const { pipeline } = createPipeline([buildStep('a')]);

      expect(() => pipeline.resume(NOW)).toThrow(InvalidPipelineStatusTransitionException);
    });
  });

  describe('cancellation', () => {
    it('cancels every non-terminal task and marks the pipeline CANCELLED', () => {
      const { pipeline } = createPipeline([buildStep('a'), buildStep('b', ['a']), buildStep('c', ['b'])]);

      pipeline.cancel(NOW);

      expect(pipeline.status).toBe('CANCELLED');
      expect(statusOf(pipeline, 'a')).toBe('CANCELLED');
      expect(statusOf(pipeline, 'b')).toBe('CANCELLED');
      expect(statusOf(pipeline, 'c')).toBe('CANCELLED');
    });

    it('leaves already-terminal tasks untouched when cancelling', () => {
      const { pipeline } = createPipeline([buildStep('a'), buildStep('b', ['a'])]);
      pipeline.startTask('a', NOW);
      pipeline.completeTask('a', NOW);

      pipeline.cancel(NOW);

      expect(statusOf(pipeline, 'a')).toBe('COMPLETED'); // untouched, already terminal
      expect(statusOf(pipeline, 'b')).toBe('CANCELLED');
    });

    it('cancels a paused pipeline', () => {
      const { pipeline } = createPipeline([buildStep('a')]);
      pipeline.pause(NOW);

      pipeline.cancel(NOW);

      expect(pipeline.status).toBe('CANCELLED');
    });

    it('refuses to cancel twice', () => {
      const { pipeline } = createPipeline([buildStep('a')]);
      pipeline.cancel(NOW);

      expect(() => pipeline.cancel(NOW)).toThrow(InvalidPipelineStatusTransitionException);
    });

    it('refuses any further lifecycle transition after cancellation', () => {
      const { pipeline } = createPipeline([buildStep('a')]);
      pipeline.cancel(NOW);

      expect(() => pipeline.startTask('a', NOW)).toThrow(InvalidPipelineStatusTransitionException);
    });
  });

  describe('determinism', () => {
    it('produces identical resulting state for two pipelines given the same operations', () => {
      const steps = [buildStep('a'), buildStep('b', ['a']), buildStep('c', ['a'])];
      const { pipeline: first } = createPipeline(steps);
      const { pipeline: second } = createPipeline(steps);

      for (const pipeline of [first, second]) {
        pipeline.startTask('a', NOW);
        pipeline.completeTask('a', NOW);
        pipeline.startTask('b', NOW);
        pipeline.completeTask('b', NOW);
      }

      expect(first.tasks.map((t) => ({ id: t.id, status: t.status }))).toEqual(
        second.tasks.map((t) => ({ id: t.id, status: t.status })),
      );
      expect(first.status).toBe(second.status);
    });
  });

  describe('explainability / traceability', () => {
    it('carries the full source blueprint for provenance', () => {
      const { pipeline, blueprint } = createPipeline([buildStep('a')]);

      expect(pipeline.basedOn).toBe(blueprint);
    });

    it('gives every task an id, title, and explanation traceable to its blueprint step', () => {
      const { pipeline } = createPipeline([buildStep('a')]);

      const task = pipeline.findTask('a')!;
      expect(task.title).toBe('Step a');
      expect(task.explanation).toBe('Explanation for a');
    });

    it('derives its own correlationId and userId from the source blueprint/decision report', () => {
      const { pipeline } = createPipeline([buildStep('a')]);

      expect(pipeline.correlationId).toBe('correlation-1');
      expect(pipeline.userId).toBe('candidate-1');
    });

    it('propagates its correlationId onto every generated task', () => {
      const { pipeline } = createPipeline([buildStep('a'), buildStep('b', ['a'])]);

      expect(pipeline.tasks.every((task) => task.correlationId === 'correlation-1')).toBe(true);
    });
  });

  describe('configuration-driven behavior (DI-swappable policies)', () => {
    it('honors a custom FailureCascadePolicy that cascades nothing', () => {
      const noCascadePolicy: FailureCascadePolicy = { cascade: () => [] };
      const { pipeline } = createPipeline([buildStep('a'), buildStep('b', ['a'])], noCascadePolicy);

      pipeline.startTask('a', NOW);
      pipeline.failTask('a', 'boom', NOW);

      expect(statusOf(pipeline, 'a')).toBe('FAILED');
      expect(statusOf(pipeline, 'b')).toBe('PENDING'); // left untouched by the custom policy
    });

    it('honors a custom TaskGenerationStrategy producing a different initial task set', () => {
      const blueprint = buildBlueprint([buildStep('a'), buildStep('b', ['a'])]);
      const allReadyStrategy = {
        generate: (bp: ExecutionBlueprint) =>
          bp.steps.map((step) => ExecutionTask.create(step.id, step.type, step.title, step.explanation, step.dependsOn, 'READY', 'correlation-1', NOW)),
      };

      const tasks = allReadyStrategy.generate(blueprint);
      const pipeline = ExecutionTaskPipeline.create(CAMPAIGN_ID, tasks, blueprint, new TransitiveDependentSkipPolicy(), NOW);

      expect(statusOf(pipeline, 'b')).toBe('READY'); // would be PENDING under the default strategy
    });
  });
});
