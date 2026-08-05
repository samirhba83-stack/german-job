import { DeliveryOverviewProjectionService } from './delivery-overview-projection.service';
import { ExecutionEventQueryService } from '../../../execution-tracking/application/services/execution-event-query.service';
import { ExecutionEvent } from '../../../execution-tracking/domain/entities/execution-event.entity';
import { ExecutionEventType } from '../../../execution-tracking/domain/models/execution-event-type';
import { EMPTY_BUSINESS_CONTEXT } from '../../../execution-tracking/domain/models/business-context';

const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildEvent(id: string, eventType: ExecutionEventType, executionId: string | null = 'task-1'): ExecutionEvent {
  return ExecutionEvent.create(id, {
    eventType,
    campaignId: null,
    executionId,
    correlationId: 'correlation-1',
    traceId: executionId ?? 'correlation-1',
    summary: 'summary',
    explanation: `${eventType} explanation`,
    status: eventType === 'EMAIL_DELIVERY_CONFIRMED' ? 'SUCCESS' : 'FAILURE',
    metadata: {},
    businessContext: EMPTY_BUSINESS_CONTEXT,
    occurredAt: NOW,
  });
}

function fakeQueryService(confirmed: ExecutionEvent[], failed: ExecutionEvent[]): ExecutionEventQueryService {
  return {
    findByEventType: jest.fn((eventType: ExecutionEventType) =>
      Promise.resolve(eventType === 'EMAIL_DELIVERY_CONFIRMED' ? confirmed : failed),
    ),
  } as unknown as ExecutionEventQueryService;
}

describe('DeliveryOverviewProjectionService', () => {
  it('computes counts and success rate from confirmed and failed events', async () => {
    const confirmed = [buildEvent('1', 'EMAIL_DELIVERY_CONFIRMED'), buildEvent('2', 'EMAIL_DELIVERY_CONFIRMED')];
    const failed = [buildEvent('3', 'EMAIL_DELIVERY_FAILED')];
    const service = new DeliveryOverviewProjectionService(fakeQueryService(confirmed, failed));

    const overview = await service.getOverview();

    expect(overview.totalAttempts).toBe(3);
    expect(overview.confirmed).toBe(2);
    expect(overview.failed).toBe(1);
    expect(overview.successRate).toBeCloseTo(2 / 3);
  });

  it('returns a successRate of 0 rather than NaN when there are no attempts', async () => {
    const service = new DeliveryOverviewProjectionService(fakeQueryService([], []));

    const overview = await service.getOverview();

    expect(overview.totalAttempts).toBe(0);
    expect(overview.successRate).toBe(0);
  });

  it('caps recentFailures at 20 entries with executionId, timestamp, and explanation', async () => {
    const failed = [buildEvent('1', 'EMAIL_DELIVERY_FAILED', 'task-1')];
    const service = new DeliveryOverviewProjectionService(fakeQueryService([], failed));

    const overview = await service.getOverview();

    expect(overview.recentFailures).toEqual([{ executionId: 'task-1', timestamp: NOW, explanation: 'EMAIL_DELIVERY_FAILED explanation' }]);
  });

  it('passes the given limit through to findByEventType', async () => {
    const queryService = fakeQueryService([], []);
    const service = new DeliveryOverviewProjectionService(queryService);

    await service.getOverview(50);

    expect(queryService.findByEventType).toHaveBeenCalledWith('EMAIL_DELIVERY_CONFIRMED', 50);
    expect(queryService.findByEventType).toHaveBeenCalledWith('EMAIL_DELIVERY_FAILED', 50);
  });
});
