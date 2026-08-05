import { ExecutionEventRecordingService } from './execution-event-recording.service';
import { ExecutionEventRepository } from '../../domain/repositories/execution-event.repository.interface';
import { ExecutionEvent } from '../../domain/entities/execution-event.entity';
import { FixedClock } from '../../../execution/infrastructure/clock/fixed-clock';
import { EMPTY_BUSINESS_CONTEXT } from '../../domain/models/business-context';

const NOW = new Date('2026-01-05T10:00:00.000Z');
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fakeRepository(): ExecutionEventRepository & { appended: ExecutionEvent[] } {
  const appended: ExecutionEvent[] = [];
  return {
    appended,
    append: jest.fn((event: ExecutionEvent) => {
      appended.push(event);
      return Promise.resolve();
    }),
    findByCampaignId: jest.fn().mockResolvedValue([]),
    findByExecutionId: jest.fn().mockResolvedValue([]),
    findRecent: jest.fn().mockResolvedValue([]),
    findByEventType: jest.fn().mockResolvedValue([]),
    findByCorrelationId: jest.fn().mockResolvedValue([]),
    findByTraceId: jest.fn().mockResolvedValue([]),
    findByCampaignIdAndTraceId: jest.fn().mockResolvedValue([]),
  };
}

describe('ExecutionEventRecordingService', () => {
  it('appends an immutable ExecutionEvent built from the input', async () => {
    const repository = fakeRepository();
    const service = new ExecutionEventRecordingService(repository, new FixedClock(NOW));

    await service.record({
      eventType: 'TASK_EXECUTED',
      campaignId: 'campaign-1',
      executionId: 'execution-1',
      correlationId: 'correlation-1',
      traceId: 'trace-1',
      summary: 'Task executed',
      explanation: 'The task completed successfully.',
      status: 'SUCCESS',
    });

    expect(repository.appended).toHaveLength(1);
    expect(repository.appended[0].eventType).toBe('TASK_EXECUTED');
    expect(repository.appended[0].campaignId).toBe('campaign-1');
    expect(repository.appended[0].correlationId).toBe('correlation-1');
    expect(repository.appended[0].traceId).toBe('trace-1');
  });

  it('generates a fresh UUID for every recorded event', async () => {
    const repository = fakeRepository();
    const service = new ExecutionEventRecordingService(repository, new FixedClock(NOW));

    await service.record({ eventType: 'DECISION_MADE', campaignId: null, executionId: null, correlationId: 'correlation-1', traceId: 'trace-1', summary: 'a', explanation: 'a', status: 'SUCCESS' });
    await service.record({ eventType: 'DECISION_MADE', campaignId: null, executionId: null, correlationId: 'correlation-2', traceId: 'trace-2', summary: 'b', explanation: 'b', status: 'SUCCESS' });

    expect(repository.appended[0].id).toMatch(UUID_REGEX);
    expect(repository.appended[1].id).toMatch(UUID_REGEX);
    expect(repository.appended[0].id).not.toBe(repository.appended[1].id);
  });

  it('stamps occurredAt from the injected clock, not wall-clock time', async () => {
    const repository = fakeRepository();
    const service = new ExecutionEventRecordingService(repository, new FixedClock(NOW));

    await service.record({ eventType: 'DECISION_MADE', campaignId: null, executionId: null, correlationId: 'correlation-1', traceId: 'trace-1', summary: 'a', explanation: 'a', status: 'SUCCESS' });

    expect(repository.appended[0].occurredAt).toBe(NOW);
  });

  it('defaults metadata to an empty object when omitted', async () => {
    const repository = fakeRepository();
    const service = new ExecutionEventRecordingService(repository, new FixedClock(NOW));

    await service.record({ eventType: 'DECISION_MADE', campaignId: null, executionId: null, correlationId: 'correlation-1', traceId: 'trace-1', summary: 'a', explanation: 'a', status: 'SUCCESS' });

    expect(repository.appended[0].metadata).toEqual({});
  });

  it('passes through supplied metadata', async () => {
    const repository = fakeRepository();
    const service = new ExecutionEventRecordingService(repository, new FixedClock(NOW));

    await service.record({
      eventType: 'PROVIDER_SELECTED',
      campaignId: null,
      executionId: null,
      correlationId: 'correlation-1',
      traceId: 'trace-1',
      summary: 'a',
      explanation: 'a',
      status: 'SUCCESS',
      metadata: { providerId: 'null-provider' },
    });

    expect(repository.appended[0].metadata).toEqual({ providerId: 'null-provider' });
  });

  it('defaults businessContext to EMPTY_BUSINESS_CONTEXT when omitted', async () => {
    const repository = fakeRepository();
    const service = new ExecutionEventRecordingService(repository, new FixedClock(NOW));

    await service.record({ eventType: 'DECISION_MADE', campaignId: null, executionId: null, correlationId: 'correlation-1', traceId: 'trace-1', summary: 'a', explanation: 'a', status: 'SUCCESS' });

    expect(repository.appended[0].businessContext).toEqual(EMPTY_BUSINESS_CONTEXT);
  });

  it('passes through supplied businessContext', async () => {
    const repository = fakeRepository();
    const service = new ExecutionEventRecordingService(repository, new FixedClock(NOW));

    await service.record({
      eventType: 'APPLICATION_PACKAGE_ASSEMBLED',
      campaignId: null,
      executionId: 'execution-1',
      correlationId: 'correlation-1',
      traceId: 'execution-1',
      summary: 'a',
      explanation: 'a',
      status: 'SUCCESS',
      businessContext: { ...EMPTY_BUSINESS_CONTEXT, companyId: 'company-1' },
    });

    expect(repository.appended[0].businessContext).toEqual({ ...EMPTY_BUSINESS_CONTEXT, companyId: 'company-1' });
  });

  it('records a FAILURE event exactly as given', async () => {
    const repository = fakeRepository();
    const service = new ExecutionEventRecordingService(repository, new FixedClock(NOW));

    await service.record({
      eventType: 'EMAIL_DELIVERY_FAILED',
      campaignId: 'campaign-1',
      executionId: 'execution-1',
      correlationId: 'correlation-1',
      traceId: 'execution-1',
      summary: 'Delivery failed',
      explanation: 'No eligible provider was available.',
      status: 'FAILURE',
    });

    expect(repository.appended[0].status).toBe('FAILURE');
  });
});
