import { RegionalProgressProjectionService } from './regional-progress-projection.service';
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

describe('RegionalProgressProjectionService', () => {
  it('produces one progress entry per campaign with region always null', async () => {
    const events = [buildTaskExecutedEvent('campaign-1', 'SUCCESS')];
    const service = new RegionalProgressProjectionService(fakeQueryService(events));

    const [progress] = await service.getProgress();

    expect(progress.campaignId).toBe('campaign-1');
    expect(progress.region).toBeNull();
  });

  it('computes completionPercentage as succeeded/executed', async () => {
    const events = [buildTaskExecutedEvent('campaign-1', 'SUCCESS'), buildTaskExecutedEvent('campaign-1', 'SUCCESS'), buildTaskExecutedEvent('campaign-1', 'FAILURE')];
    const service = new RegionalProgressProjectionService(fakeQueryService(events));

    const [progress] = await service.getProgress();

    expect(progress.tasksExecuted).toBe(3);
    expect(progress.tasksSucceeded).toBe(2);
    expect(progress.tasksFailed).toBe(1);
    expect(progress.completionPercentage).toBe(67);
  });

  it('returns an empty list when no campaigns have executed tasks', async () => {
    const service = new RegionalProgressProjectionService(fakeQueryService([]));

    expect(await service.getProgress()).toEqual([]);
  });

  it('passes the given limit through to findByEventType', async () => {
    const queryService = fakeQueryService([]);
    const service = new RegionalProgressProjectionService(queryService);

    await service.getProgress(300);

    expect(queryService.findByEventType).toHaveBeenCalledWith('TASK_EXECUTED', 300);
  });
});
