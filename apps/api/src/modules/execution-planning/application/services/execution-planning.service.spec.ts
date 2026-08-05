import { ExecutionPlanningService } from './execution-planning.service';
import { DecisionIntelligenceService } from '../../../decision-intelligence/application/services/decision-intelligence.service';
import { DecisionReport } from '../../../decision-intelligence/domain/decision-report';
import { DeterministicExecutionPlanningStrategy } from '../../domain/strategies/deterministic-execution-planning.strategy';
import { DEFAULT_EXECUTION_PLANNING_CONFIG } from '../../domain/execution-planning-config';
import { ExecutionPlanningStrategy } from '../../domain/ports/execution-planning-strategy.port';
import { ExecutionBlueprint } from '../../domain/execution-blueprint';
import { ExecutionEventRecorder } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';

function fakeEventRecorder(): ExecutionEventRecorder {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

function buildDecisionReport(campaignId: string): DecisionReport {
  return {
    id: `decision-${campaignId}`,
    campaignId,
    correlationId: `correlation-${campaignId}`,
    userId: `candidate-${campaignId}`,
    finalRecommendation: null,
    confidenceScore: 1,
    businessJustification: 'No recommendations were produced by any registered strategy.',
    explanation: 'No action is recommended; execution can proceed according to the current plan.',
    supportingEvidence: [],
    conflicts: [],
  };
}

function fakeDecisionIntelligence(reports: DecisionReport[]): DecisionIntelligenceService {
  return { generateDecisionReports: jest.fn().mockResolvedValue(reports) } as unknown as DecisionIntelligenceService;
}

describe('ExecutionPlanningService', () => {
  it('produces one ExecutionBlueprint per DecisionReport, delegating to the injected strategy', async () => {
    const reportA = buildDecisionReport('campaign-1');
    const reportB = buildDecisionReport('campaign-2');
    const decisionIntelligence = fakeDecisionIntelligence([reportA, reportB]);
    const strategy = new DeterministicExecutionPlanningStrategy(DEFAULT_EXECUTION_PLANNING_CONFIG);
    const service = new ExecutionPlanningService(decisionIntelligence, strategy, fakeEventRecorder());

    const blueprints = await service.generateExecutionBlueprints();

    expect(blueprints).toHaveLength(2);
    expect(blueprints[0].campaignId).toBe('campaign-1');
    expect(blueprints[1].campaignId).toBe('campaign-2');
    expect(blueprints[0].basedOn).toBe(reportA);
  });

  it('honors an injected ExecutionPlanningStrategy binding, proving planning logic is swappable without touching the service', async () => {
    const report = buildDecisionReport('campaign-1');
    const decisionIntelligence = fakeDecisionIntelligence([report]);
    const customBlueprint = {
      campaignId: 'campaign-1',
      steps: [],
      phases: [],
      batchSchedule: { batchCount: 0, entries: [] },
      executionWindows: [],
      retryPlan: { entries: [] },
      pacingStrategy: { interBatchDelayMs: 0, interStepDelayMs: 0 },
      cooldownPlan: { entries: [] },
      dependencyGraph: { edges: [] },
      explanation: 'custom strategy explanation',
      basedOn: report,
    } satisfies ExecutionBlueprint;
    const customStrategy: ExecutionPlanningStrategy = { plan: jest.fn().mockReturnValue(customBlueprint) };
    const service = new ExecutionPlanningService(decisionIntelligence, customStrategy, fakeEventRecorder());

    const [blueprint] = await service.generateExecutionBlueprints();

    expect(blueprint).toBe(customBlueprint);
    expect(customStrategy.plan).toHaveBeenCalledWith(report);
  });
});
