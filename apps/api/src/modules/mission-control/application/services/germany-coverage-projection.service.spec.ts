import { GermanyCoverageProjectionService } from './germany-coverage-projection.service';
import { ExecutionEventQueryService } from '../../../execution-tracking/application/services/execution-event-query.service';
import { ExecutionEvent } from '../../../execution-tracking/domain/entities/execution-event.entity';
import { ExecutionEventStatus } from '../../../execution-tracking/domain/models/execution-event-type';
import { EMPTY_BUSINESS_CONTEXT } from '../../../execution-tracking/domain/models/business-context';

const NOW = new Date('2026-01-05T10:00:00.000Z');
let counter = 0;

function buildTaskExecutedEvent(campaignId: string, status: ExecutionEventStatus): ExecutionEvent {
  counter += 1;
  return ExecutionEvent.create(`event-${counter}`, {
    eventType: 'TASK_EXECUTED',
    campaignId,
    executionId: 'task-1',
    correlationId: 'correlation-1',
    traceId: 'task-1',
    summary: 'summary',
    explanation: 'explanation',
    status,
    metadata: {},
    businessContext: EMPTY_BUSINESS_CONTEXT,
    occurredAt: NOW,
  });
}

function fakeQueryService(events: ExecutionEvent[]): ExecutionEventQueryService {
  return { findByEventType: jest.fn().mockResolvedValue(events) } as unknown as ExecutionEventQueryService;
}

describe('GermanyCoverageProjectionService', () => {
  it('counts distinct campaigns and their success/failure standing', async () => {
    const events = [
      buildTaskExecutedEvent('campaign-1', 'SUCCESS'),
      buildTaskExecutedEvent('campaign-1', 'SUCCESS'),
      buildTaskExecutedEvent('campaign-2', 'FAILURE'),
    ];
    const service = new GermanyCoverageProjectionService(fakeQueryService(events));

    const coverage = await service.getCoverage();

    expect(coverage.totalCampaignsObserved).toBe(2);
    expect(coverage.campaignsFullySucceeding).toBe(1);
    expect(coverage.campaignsWithAnyFailure).toBe(1);
  });

  it('computes campaignCoveragePercentage as the share of successful tasks across all campaigns', async () => {
    const events = [buildTaskExecutedEvent('campaign-1', 'SUCCESS'), buildTaskExecutedEvent('campaign-1', 'FAILURE')];
    const service = new GermanyCoverageProjectionService(fakeQueryService(events));

    const coverage = await service.getCoverage();

    expect(coverage.campaignCoveragePercentage).toBe(50);
  });

  it('returns 0 coverage and zero campaigns when nothing has executed', async () => {
    const service = new GermanyCoverageProjectionService(fakeQueryService([]));

    const coverage = await service.getCoverage();

    expect(coverage.totalCampaignsObserved).toBe(0);
    expect(coverage.campaignCoveragePercentage).toBe(0);
  });

  it('always includes the honest note explaining the campaign-level (not geographic) proxy', async () => {
    const service = new GermanyCoverageProjectionService(fakeQueryService([]));

    const coverage = await service.getCoverage();

    expect(coverage.note).toContain('Geographic coverage requires company/region data');
  });
});
