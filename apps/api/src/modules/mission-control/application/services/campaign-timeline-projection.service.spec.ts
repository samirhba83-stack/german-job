import { CampaignTimelineProjectionService } from './campaign-timeline-projection.service';
import { ExecutionEventQueryService } from '../../../execution-tracking/application/services/execution-event-query.service';
import { ExecutionEvent } from '../../../execution-tracking/domain/entities/execution-event.entity';
import { EMPTY_BUSINESS_CONTEXT } from '../../../execution-tracking/domain/models/business-context';

const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildEvent(id: string): ExecutionEvent {
  return ExecutionEvent.create(id, {
    eventType: 'DECISION_MADE',
    campaignId: 'campaign-1',
    executionId: null,
    correlationId: 'correlation-1',
    traceId: 'correlation-1',
    summary: 'summary',
    explanation: 'a decision was made',
    status: 'SUCCESS',
    metadata: { confidenceScore: '0.9' },
    businessContext: EMPTY_BUSINESS_CONTEXT,
    occurredAt: NOW,
  });
}

function fakeQueryService(events: ExecutionEvent[]): ExecutionEventQueryService {
  return { findByCampaignId: jest.fn().mockResolvedValue(events) } as unknown as ExecutionEventQueryService;
}

describe('CampaignTimelineProjectionService', () => {
  it('maps events into timeline entries in the order returned by the query service', async () => {
    const events = [buildEvent('1'), buildEvent('2')];
    const queryService = fakeQueryService(events);
    const service = new CampaignTimelineProjectionService(queryService);

    const timeline = await service.getTimeline('campaign-1');

    expect(queryService.findByCampaignId).toHaveBeenCalledWith('campaign-1');
    expect(timeline).toHaveLength(2);
    expect(timeline[0]).toEqual({
      timestamp: NOW,
      eventType: 'DECISION_MADE',
      executionId: null,
      campaignId: 'campaign-1',
      correlationId: 'correlation-1',
      traceId: 'correlation-1',
      explanation: 'a decision was made',
      status: 'SUCCESS',
      metadata: { confidenceScore: '0.9' },
      businessContext: EMPTY_BUSINESS_CONTEXT,
    });
  });

  it('returns an empty timeline for a campaign with no events', async () => {
    const queryService = fakeQueryService([]);
    const service = new CampaignTimelineProjectionService(queryService);

    const timeline = await service.getTimeline('unknown-campaign');

    expect(timeline).toEqual([]);
  });
});
