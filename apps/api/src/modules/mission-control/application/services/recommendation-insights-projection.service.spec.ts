import { RecommendationInsightsProjectionService } from './recommendation-insights-projection.service';
import { ExecutionEventQueryService } from '../../../execution-tracking/application/services/execution-event-query.service';
import { ExecutionEvent } from '../../../execution-tracking/domain/entities/execution-event.entity';
import { EMPTY_BUSINESS_CONTEXT } from '../../../execution-tracking/domain/models/business-context';

const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildEvent(id: string, campaignId: string | null, recommendationCount?: string): ExecutionEvent {
  return ExecutionEvent.create(id, {
    eventType: 'RECOMMENDATION_GENERATED',
    campaignId,
    executionId: null,
    correlationId: 'correlation-1',
    traceId: 'correlation-1',
    summary: 'summary',
    explanation: 'recommendations generated',
    status: 'SUCCESS',
    metadata: recommendationCount === undefined ? {} : { recommendationCount },
    businessContext: EMPTY_BUSINESS_CONTEXT,
    occurredAt: NOW,
  });
}

function fakeQueryService(events: ExecutionEvent[]): ExecutionEventQueryService {
  return { findByEventType: jest.fn().mockResolvedValue(events) } as unknown as ExecutionEventQueryService;
}

describe('RecommendationInsightsProjectionService', () => {
  it('maps recommendation events into insights with parsed counts', async () => {
    const events = [buildEvent('1', 'campaign-1', '3')];
    const service = new RecommendationInsightsProjectionService(fakeQueryService(events));

    const insights = await service.getInsights();

    expect(insights).toEqual([{ campaignId: 'campaign-1', timestamp: NOW, recommendationCount: 3, explanation: 'recommendations generated' }]);
  });

  it('defaults recommendationCount to 0 when metadata is missing it', async () => {
    const events = [buildEvent('1', 'campaign-1')];
    const service = new RecommendationInsightsProjectionService(fakeQueryService(events));

    const [insight] = await service.getInsights();

    expect(insight.recommendationCount).toBe(0);
  });

  it('queries RECOMMENDATION_GENERATED with the given limit', async () => {
    const queryService = fakeQueryService([]);
    const service = new RecommendationInsightsProjectionService(queryService);

    await service.getInsights(75);

    expect(queryService.findByEventType).toHaveBeenCalledWith('RECOMMENDATION_GENERATED', 75);
  });

  it('returns an empty array when nothing has been recorded', async () => {
    const service = new RecommendationInsightsProjectionService(fakeQueryService([]));

    expect(await service.getInsights()).toEqual([]);
  });
});
