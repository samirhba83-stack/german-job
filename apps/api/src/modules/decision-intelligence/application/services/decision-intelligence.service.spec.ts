import { DecisionIntelligenceService } from './decision-intelligence.service';
import { RecommendationEngineService } from '../../../recommendations/application/services/recommendation-engine.service';
import { Recommendation } from '../../../recommendations/domain/recommendation';
import { WeightedPriorityDecisionStrategy } from '../../domain/strategies/weighted-priority-decision.strategy';
import { DEFAULT_DECISION_CONFIG } from '../../domain/decision-config';
import { DecisionAggregationStrategy } from '../../domain/ports/decision-aggregation-strategy.port';
import { ExecutionEventRecorder } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';

function fakeEventRecorder(): ExecutionEventRecorder {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

let recommendationCounter = 0;

function buildRecommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  recommendationCounter += 1;
  return {
    id: `recommendation-${recommendationCounter}`,
    campaignId: 'campaign-1',
    category: 'RISK',
    title: 'Test recommendation',
    explanation: 'Test explanation.',
    reasonCode: 'TEST_REASON',
    expectedImpactScore: 0.5,
    producedBy: 'TEST_STRATEGY',
    ...overrides,
  };
}

function fakeRecommendationEngine(
  entries: Array<{ campaign: { id: string; ownerId: string }; executionPlan: unknown; recommendations: Recommendation[]; correlationId: string }>,
): RecommendationEngineService {
  return { generateRecommendationsByCampaign: jest.fn().mockResolvedValue(entries) } as unknown as RecommendationEngineService;
}

describe('DecisionIntelligenceService', () => {
  it('produces one DecisionReport per campaign, delegating aggregation to the injected strategy', async () => {
    const recommendationA = buildRecommendation({ campaignId: 'campaign-1' });
    const recommendationB = buildRecommendation({ campaignId: 'campaign-2', category: 'STRATEGY' });
    const engine = fakeRecommendationEngine([
      { campaign: { id: 'campaign-1', ownerId: 'candidate-1' }, executionPlan: {}, recommendations: [recommendationA], correlationId: 'correlation-1' },
      { campaign: { id: 'campaign-2', ownerId: 'candidate-2' }, executionPlan: {}, recommendations: [recommendationB], correlationId: 'correlation-2' },
    ]);
    const strategy = new WeightedPriorityDecisionStrategy(DEFAULT_DECISION_CONFIG);
    const service = new DecisionIntelligenceService(engine, strategy, fakeEventRecorder());

    const reports = await service.generateDecisionReports();

    expect(reports).toHaveLength(2);
    expect(reports[0].campaignId).toBe('campaign-1');
    expect(reports[0].finalRecommendation).toBe(recommendationA);
    expect(reports[0].correlationId).toBe('correlation-1');
    expect(reports[0].userId).toBe('candidate-1');
    expect(reports[1].campaignId).toBe('campaign-2');
    expect(reports[1].finalRecommendation).toBe(recommendationB);
  });

  it('produces a confident no-action report for a campaign with zero recommendations', async () => {
    const engine = fakeRecommendationEngine([
      { campaign: { id: 'campaign-1', ownerId: 'candidate-1' }, executionPlan: {}, recommendations: [], correlationId: 'correlation-1' },
    ]);
    const strategy = new WeightedPriorityDecisionStrategy(DEFAULT_DECISION_CONFIG);
    const service = new DecisionIntelligenceService(engine, strategy, fakeEventRecorder());

    const [report] = await service.generateDecisionReports();

    expect(report.finalRecommendation).toBeNull();
    expect(report.confidenceScore).toBe(1);
  });

  it('assigns each DecisionReport a fresh, unique id', async () => {
    const engine = fakeRecommendationEngine([
      { campaign: { id: 'campaign-1', ownerId: 'candidate-1' }, executionPlan: {}, recommendations: [], correlationId: 'correlation-1' },
      { campaign: { id: 'campaign-2', ownerId: 'candidate-2' }, executionPlan: {}, recommendations: [], correlationId: 'correlation-2' },
    ]);
    const strategy = new WeightedPriorityDecisionStrategy(DEFAULT_DECISION_CONFIG);
    const service = new DecisionIntelligenceService(engine, strategy, fakeEventRecorder());

    const reports = await service.generateDecisionReports();

    expect(reports[0].id).toEqual(expect.any(String));
    expect(reports[1].id).toEqual(expect.any(String));
    expect(reports[0].id).not.toBe(reports[1].id);
  });

  it('honors an injected DecisionAggregationStrategy binding, proving aggregation is swappable without touching the service', async () => {
    const recommendation = buildRecommendation();
    const engine = fakeRecommendationEngine([
      { campaign: { id: 'campaign-1', ownerId: 'candidate-1' }, executionPlan: {}, recommendations: [recommendation], correlationId: 'correlation-1' },
    ]);
    const customReport = {
      campaignId: 'campaign-1',
      finalRecommendation: null,
      confidenceScore: 0.42,
      businessJustification: 'custom strategy justification',
      explanation: 'custom strategy explanation',
      supportingEvidence: [],
      conflicts: [],
    };
    const customStrategy: DecisionAggregationStrategy = { aggregate: jest.fn().mockReturnValue(customReport) };
    const service = new DecisionIntelligenceService(engine, customStrategy, fakeEventRecorder());

    const [report] = await service.generateDecisionReports();

    expect(report).toMatchObject(customReport);
    expect(customStrategy.aggregate).toHaveBeenCalledWith({ campaignId: 'campaign-1', recommendations: [recommendation] });
  });
});
