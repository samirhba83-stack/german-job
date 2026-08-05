import { ExecutionOrchestratorService } from './execution-orchestrator.service';
import { ExecutionPlanningService } from '../../../execution-planning/application/services/execution-planning.service';
import { ExecutionBlueprint, ExecutionStep } from '../../../execution-planning/domain/execution-blueprint';
import { DecisionReport } from '../../../decision-intelligence/domain/decision-report';
import { FixedClock } from '../../../execution/infrastructure/clock/fixed-clock';
import { BlueprintStepTaskGenerationStrategy } from '../../domain/strategies/blueprint-step-task-generation.strategy';
import { TransitiveDependentSkipPolicy } from '../../domain/strategies/transitive-dependent-skip.policy';
import { TaskGenerationStrategy } from '../../domain/ports/task-generation-strategy.port';
import { ExecutionTask } from '../../domain/entities/execution-task.entity';
import { ExecutionEventRecorder } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';

function fakeEventRecorder(): ExecutionEventRecorder {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildStep(id: string, dependsOn: string[] = []): ExecutionStep {
  return { id, type: 'BATCH_EXECUTION', phase: 0, title: `Step ${id}`, explanation: `Explanation for ${id}`, dependsOn };
}

function buildBlueprint(campaignId: string, steps: ExecutionStep[]): ExecutionBlueprint {
  const report: DecisionReport = {
    id: `decision-${campaignId}`,
    campaignId,
    correlationId: `correlation-${campaignId}`,
    userId: `candidate-${campaignId}`,
    finalRecommendation: null,
    confidenceScore: 1,
    businessJustification: 'test',
    explanation: 'test',
    supportingEvidence: [],
    conflicts: [],
  };
  return {
    campaignId,
    steps,
    phases: [],
    batchSchedule: { batchCount: 0, entries: [] },
    executionWindows: [],
    retryPlan: { entries: [] },
    pacingStrategy: { interBatchDelayMs: 0, interStepDelayMs: 0 },
    cooldownPlan: { entries: [] },
    dependencyGraph: { edges: [] },
    explanation: 'test',
    basedOn: report,
  };
}

function fakePlanningService(blueprints: ExecutionBlueprint[]): ExecutionPlanningService {
  return { generateExecutionBlueprints: jest.fn().mockResolvedValue(blueprints) } as unknown as ExecutionPlanningService;
}

describe('ExecutionOrchestratorService', () => {
  it('produces one ExecutionTaskPipeline per blueprint', async () => {
    const blueprintA = buildBlueprint('campaign-1', [buildStep('a')]);
    const blueprintB = buildBlueprint('campaign-2', [buildStep('a'), buildStep('b', ['a'])]);
    const planningService = fakePlanningService([blueprintA, blueprintB]);
    const service = new ExecutionOrchestratorService(
      planningService,
      new FixedClock(NOW),
      new BlueprintStepTaskGenerationStrategy(),
      new TransitiveDependentSkipPolicy(),
      fakeEventRecorder(),
    );

    const pipelines = await service.generatePipelines();

    expect(pipelines).toHaveLength(2);
    expect(pipelines[0].campaignId).toBe('campaign-1');
    expect(pipelines[0].basedOn).toBe(blueprintA);
    expect(pipelines[1].campaignId).toBe('campaign-2');
  });

  it('produces a FINISHED pipeline for a blueprint with no steps', async () => {
    const blueprint = buildBlueprint('campaign-1', []);
    const planningService = fakePlanningService([blueprint]);
    const service = new ExecutionOrchestratorService(
      planningService,
      new FixedClock(NOW),
      new BlueprintStepTaskGenerationStrategy(),
      new TransitiveDependentSkipPolicy(),
      fakeEventRecorder(),
    );

    const [pipeline] = await service.generatePipelines();

    expect(pipeline.status).toBe('FINISHED');
  });

  it('honors an injected TaskGenerationStrategy binding, proving task generation is swappable without touching the service', async () => {
    const blueprint = buildBlueprint('campaign-1', [buildStep('a'), buildStep('b', ['a'])]);
    const planningService = fakePlanningService([blueprint]);
    const allReadyStrategy: TaskGenerationStrategy = {
      generate: jest.fn((bp: ExecutionBlueprint) =>
        bp.steps.map((step) =>
          ExecutionTask.create(step.id, step.type, step.title, step.explanation, step.dependsOn, 'READY', 'correlation-campaign-1', NOW),
        ),
      ),
    };
    const service = new ExecutionOrchestratorService(
      planningService,
      new FixedClock(NOW),
      allReadyStrategy,
      new TransitiveDependentSkipPolicy(),
      fakeEventRecorder(),
    );

    const [pipeline] = await service.generatePipelines();

    expect(allReadyStrategy.generate).toHaveBeenCalledWith(blueprint, NOW);
    expect(pipeline.findTask('b')?.status).toBe('READY');
  });
});
