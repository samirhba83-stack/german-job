import { ExecutionEventQueryService } from './execution-event-query.service';
import { ExecutionEventRepository } from '../../domain/repositories/execution-event.repository.interface';
import { ExecutionEvent } from '../../domain/entities/execution-event.entity';
import { EMPTY_BUSINESS_CONTEXT } from '../../domain/models/business-context';

const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildEvent(id: string): ExecutionEvent {
  return ExecutionEvent.create(id, {
    eventType: 'TASK_EXECUTED',
    campaignId: 'campaign-1',
    executionId: 'execution-1',
    correlationId: 'correlation-1',
    traceId: 'execution-1',
    summary: 'summary',
    explanation: 'explanation',
    status: 'SUCCESS',
    metadata: {},
    businessContext: EMPTY_BUSINESS_CONTEXT,
    occurredAt: NOW,
  });
}

function fakeRepository(overrides: Partial<ExecutionEventRepository> = {}): ExecutionEventRepository {
  return {
    append: jest.fn(),
    findByCampaignId: jest.fn().mockResolvedValue([]),
    findByExecutionId: jest.fn().mockResolvedValue([]),
    findRecent: jest.fn().mockResolvedValue([]),
    findByEventType: jest.fn().mockResolvedValue([]),
    findByCorrelationId: jest.fn().mockResolvedValue([]),
    findByTraceId: jest.fn().mockResolvedValue([]),
    findByCampaignIdAndTraceId: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('ExecutionEventQueryService', () => {
  it('delegates findByCampaignId to the repository', async () => {
    const events = [buildEvent('1'), buildEvent('2')];
    const repository = fakeRepository({ findByCampaignId: jest.fn().mockResolvedValue(events) });
    const service = new ExecutionEventQueryService(repository);

    const result = await service.findByCampaignId('campaign-1');

    expect(repository.findByCampaignId).toHaveBeenCalledWith('campaign-1');
    expect(result).toBe(events);
  });

  it('delegates findByExecutionId to the repository', async () => {
    const events = [buildEvent('1')];
    const repository = fakeRepository({ findByExecutionId: jest.fn().mockResolvedValue(events) });
    const service = new ExecutionEventQueryService(repository);

    const result = await service.findByExecutionId('execution-1');

    expect(repository.findByExecutionId).toHaveBeenCalledWith('execution-1');
    expect(result).toBe(events);
  });

  it('delegates findRecent with the given limit', async () => {
    const events = [buildEvent('1')];
    const repository = fakeRepository({ findRecent: jest.fn().mockResolvedValue(events) });
    const service = new ExecutionEventQueryService(repository);

    const result = await service.findRecent(50);

    expect(repository.findRecent).toHaveBeenCalledWith(50);
    expect(result).toBe(events);
  });

  it('delegates findByEventType with the event type and limit', async () => {
    const events = [buildEvent('1')];
    const repository = fakeRepository({ findByEventType: jest.fn().mockResolvedValue(events) });
    const service = new ExecutionEventQueryService(repository);

    const result = await service.findByEventType('TASK_EXECUTED', 100);

    expect(repository.findByEventType).toHaveBeenCalledWith('TASK_EXECUTED', 100);
    expect(result).toBe(events);
  });

  it('delegates findByCorrelationId to the repository', async () => {
    const events = [buildEvent('1')];
    const repository = fakeRepository({ findByCorrelationId: jest.fn().mockResolvedValue(events) });
    const service = new ExecutionEventQueryService(repository);

    const result = await service.findByCorrelationId('correlation-1');

    expect(repository.findByCorrelationId).toHaveBeenCalledWith('correlation-1');
    expect(result).toBe(events);
  });

  it('delegates findByTraceId to the repository', async () => {
    const events = [buildEvent('1')];
    const repository = fakeRepository({ findByTraceId: jest.fn().mockResolvedValue(events) });
    const service = new ExecutionEventQueryService(repository);

    const result = await service.findByTraceId('trace-1');

    expect(repository.findByTraceId).toHaveBeenCalledWith('trace-1');
    expect(result).toBe(events);
  });

  it('delegates findByCampaignIdAndTraceId to the repository', async () => {
    const events = [buildEvent('1')];
    const repository = fakeRepository({ findByCampaignIdAndTraceId: jest.fn().mockResolvedValue(events) });
    const service = new ExecutionEventQueryService(repository);

    const result = await service.findByCampaignIdAndTraceId('campaign-1', 'trace-1');

    expect(repository.findByCampaignIdAndTraceId).toHaveBeenCalledWith('campaign-1', 'trace-1');
    expect(result).toBe(events);
  });

  it('returns an empty array when nothing matches', async () => {
    const repository = fakeRepository();
    const service = new ExecutionEventQueryService(repository);

    const result = await service.findByCampaignId('no-events-campaign');

    expect(result).toEqual([]);
  });
});
