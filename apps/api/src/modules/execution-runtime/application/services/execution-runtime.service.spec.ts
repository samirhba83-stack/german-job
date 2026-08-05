import { ExecutionRuntimeService } from './execution-runtime.service';
import { ExecutionOrchestratorService } from '../../../execution-orchestrator/application/services/execution-orchestrator.service';
import { ExecutionTaskPipeline } from '../../../execution-orchestrator/domain/entities/execution-task-pipeline.entity';
import { BlueprintStepTaskGenerationStrategy } from '../../../execution-orchestrator/domain/strategies/blueprint-step-task-generation.strategy';
import { TransitiveDependentSkipPolicy } from '../../../execution-orchestrator/domain/strategies/transitive-dependent-skip.policy';
import { ExecutionBlueprint, ExecutionStep } from '../../../execution-planning/domain/execution-blueprint';
import { DecisionReport } from '../../../decision-intelligence/domain/decision-report';
import { DeterministicTaskSelectionStrategy } from '../../domain/strategies/deterministic-task-selection.strategy';
import { DEFAULT_TASK_SELECTION_CONFIG } from '../../domain/task-selection-config';
import { TaskSelectionStrategy } from '../../domain/ports/task-selection-strategy.port';
import { ExecutionEventRecorder } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';

function fakeEventRecorder(): ExecutionEventRecorder {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildStep(id: string, dependsOn: string[] = []): ExecutionStep {
  return { id, type: 'PREPARATION', phase: 0, title: `Step ${id}`, explanation: `Explanation for ${id}`, dependsOn };
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

function buildPipeline(campaignId: string, steps: ExecutionStep[]): ExecutionTaskPipeline {
  const blueprint = buildBlueprint(campaignId, steps);
  const tasks = new BlueprintStepTaskGenerationStrategy().generate(blueprint, NOW);
  return ExecutionTaskPipeline.create(campaignId, tasks, blueprint, new TransitiveDependentSkipPolicy(), NOW);
}

function fakeOrchestrator(pipelines: ExecutionTaskPipeline[]): ExecutionOrchestratorService {
  return { generatePipelines: jest.fn().mockResolvedValue(pipelines) } as unknown as ExecutionOrchestratorService;
}

describe('ExecutionRuntimeService', () => {
  it('produces one TaskSelectionDecision per pipeline', async () => {
    const pipelineA = buildPipeline('campaign-1', [buildStep('a')]);
    const pipelineB = buildPipeline('campaign-2', [buildStep('a')]);
    const orchestrator = fakeOrchestrator([pipelineA, pipelineB]);
    const strategy = new DeterministicTaskSelectionStrategy(DEFAULT_TASK_SELECTION_CONFIG);
    const service = new ExecutionRuntimeService(orchestrator, strategy, fakeEventRecorder());

    const decisions = await service.selectNextTasks();

    expect(decisions).toHaveLength(2);
    expect(decisions[0].campaignId).toBe('campaign-1');
    expect(decisions[0].selectedTaskId).toBe('a');
    expect(decisions[1].campaignId).toBe('campaign-2');
  });

  it('honors an injected TaskSelectionStrategy binding, proving selection logic is swappable without touching the service', async () => {
    const pipeline = buildPipeline('campaign-1', [buildStep('a')]);
    const orchestrator = fakeOrchestrator([pipeline]);
    const customDecision = {
      campaignId: 'campaign-1',
      selectedTaskId: null,
      reasonCode: 'CUSTOM_REASON',
      explanation: 'custom strategy explanation',
      candidates: [],
      correlationId: 'correlation-campaign-1',
      userId: 'candidate-campaign-1',
    };
    const customStrategy: TaskSelectionStrategy = { select: jest.fn().mockReturnValue(customDecision) };
    const service = new ExecutionRuntimeService(orchestrator, customStrategy, fakeEventRecorder());

    const [decision] = await service.selectNextTasks();

    expect(decision).toBe(customDecision);
    expect(customStrategy.select).toHaveBeenCalledWith(pipeline);
  });
});
