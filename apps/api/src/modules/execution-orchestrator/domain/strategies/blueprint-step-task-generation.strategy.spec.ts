import { BlueprintStepTaskGenerationStrategy } from './blueprint-step-task-generation.strategy';
import { ExecutionBlueprint, ExecutionStep } from '../../../execution-planning/domain/execution-blueprint';
import { DecisionReport } from '../../../decision-intelligence/domain/decision-report';

const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildStep(id: string, dependsOn: string[] = []): ExecutionStep {
  return { id, type: 'BATCH_EXECUTION', phase: 0, title: `Step ${id}`, explanation: `Explanation for ${id}`, dependsOn };
}

function buildBlueprint(steps: ExecutionStep[]): ExecutionBlueprint {
  const report: DecisionReport = {
    id: 'decision-1',
    campaignId: 'campaign-1',
    correlationId: 'correlation-1',
    userId: 'candidate-1',
    finalRecommendation: null,
    confidenceScore: 1,
    businessJustification: 'test',
    explanation: 'test',
    supportingEvidence: [],
    conflicts: [],
  };
  return {
    campaignId: 'campaign-1',
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

describe('BlueprintStepTaskGenerationStrategy', () => {
  const strategy = new BlueprintStepTaskGenerationStrategy();

  it('maps each step to a task with matching id, type, title, explanation, and dependencies', () => {
    const [task] = strategy.generate(buildBlueprint([buildStep('a', ['x'])]), NOW);

    expect(task.id).toBe('a');
    expect(task.type).toBe('BATCH_EXECUTION');
    expect(task.title).toBe('Step a');
    expect(task.explanation).toBe('Explanation for a');
    expect(task.dependsOn).toEqual(['x']);
  });

  it('starts a task with no dependencies as READY', () => {
    const [task] = strategy.generate(buildBlueprint([buildStep('a')]), NOW);
    expect(task.status).toBe('READY');
  });

  it('starts a task with dependencies as PENDING', () => {
    const [task] = strategy.generate(buildBlueprint([buildStep('a', ['x'])]), NOW);
    expect(task.status).toBe('PENDING');
  });

  it('inherits correlationId from the blueprint (basedOn.correlationId)', () => {
    const [task] = strategy.generate(buildBlueprint([buildStep('a')]), NOW);
    expect(task.correlationId).toBe('correlation-1');
  });

  it('preserves step order', () => {
    const tasks = strategy.generate(buildBlueprint([buildStep('a'), buildStep('b'), buildStep('c')]), NOW);
    expect(tasks.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });
});
