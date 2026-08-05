import { TrustCenterProjectionService } from './trust-center-projection.service';
import { ExecutionEventQueryService } from '../../../execution-tracking/application/services/execution-event-query.service';
import { ExecutionEvent } from '../../../execution-tracking/domain/entities/execution-event.entity';
import { ExecutionEventStatus, ExecutionEventType } from '../../../execution-tracking/domain/models/execution-event-type';
import { BusinessContext, EMPTY_BUSINESS_CONTEXT } from '../../../execution-tracking/domain/models/business-context';

const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildEvent(
  id: string,
  eventType: ExecutionEventType,
  status: ExecutionEventStatus,
  metadata: Record<string, string> = {},
  businessContext: BusinessContext = EMPTY_BUSINESS_CONTEXT,
  occurredAt: Date = NOW,
): ExecutionEvent {
  return ExecutionEvent.create(id, {
    eventType,
    campaignId: 'campaign-1',
    executionId: 'task-1',
    correlationId: 'correlation-1',
    traceId: 'task-1',
    summary: 'summary',
    explanation: `${eventType} explanation`,
    status,
    metadata,
    businessContext,
    occurredAt,
  });
}

function fakeQueryService(events: ExecutionEvent[]): ExecutionEventQueryService {
  return { findByTraceId: jest.fn().mockResolvedValue(events) } as unknown as ExecutionEventQueryService;
}

describe('TrustCenterProjectionService', () => {
  it('returns hasEvents=false and nulls for a trace id with no events', async () => {
    const service = new TrustCenterProjectionService(fakeQueryService([]));

    const trace = await service.getExecutionTrace('unknown-task');

    expect(trace).toEqual({
      traceId: 'unknown-task',
      hasEvents: false,
      events: [],
      selectedProviderId: null,
      deliveryStatus: null,
      durationMs: null,
      overallStatus: null,
      workerId: null,
      geography: null,
    });
  });

  it('derives selectedProviderId and deliveryStatus from the delivery event metadata', async () => {
    const events = [
      buildEvent('1', 'TASK_SELECTED', 'SUCCESS'),
      buildEvent('2', 'TASK_EXECUTED', 'SUCCESS', { durationMs: '150' }),
      buildEvent('3', 'EMAIL_DELIVERY_CONFIRMED', 'SUCCESS', { providerId: 'null-provider', deliveryStatus: 'ACCEPTED' }),
    ];
    const service = new TrustCenterProjectionService(fakeQueryService(events));

    const trace = await service.getExecutionTrace('task-1');

    expect(trace.hasEvents).toBe(true);
    expect(trace.selectedProviderId).toBe('null-provider');
    expect(trace.deliveryStatus).toBe('ACCEPTED');
    expect(trace.events).toHaveLength(3);
  });

  it('falls back to PROVIDER_SELECTED businessContext.providerId when no delivery event carries one', async () => {
    const events = [buildEvent('1', 'PROVIDER_SELECTED', 'SUCCESS', {}, { ...EMPTY_BUSINESS_CONTEXT, providerId: 'gmail-adapter' })];
    const service = new TrustCenterProjectionService(fakeQueryService(events));

    const trace = await service.getExecutionTrace('task-1');

    expect(trace.selectedProviderId).toBe('gmail-adapter');
  });

  it('derives durationMs from the TASK_EXECUTED event metadata', async () => {
    const events = [buildEvent('1', 'TASK_EXECUTED', 'SUCCESS', { durationMs: '250' })];
    const service = new TrustCenterProjectionService(fakeQueryService(events));

    const trace = await service.getExecutionTrace('task-1');

    expect(trace.durationMs).toBe(250);
  });

  it('returns null durationMs when no TASK_EXECUTED event is present', async () => {
    const events = [buildEvent('1', 'TASK_SELECTED', 'SUCCESS')];
    const service = new TrustCenterProjectionService(fakeQueryService(events));

    const trace = await service.getExecutionTrace('task-1');

    expect(trace.durationMs).toBeNull();
  });

  it('uses the last event status as overallStatus', async () => {
    const events = [buildEvent('1', 'TASK_SELECTED', 'SUCCESS'), buildEvent('2', 'EMAIL_DELIVERY_FAILED', 'FAILURE')];
    const service = new TrustCenterProjectionService(fakeQueryService(events));

    const trace = await service.getExecutionTrace('task-1');

    expect(trace.overallStatus).toBe('FAILURE');
  });

  it('returns null selectedProviderId/deliveryStatus when no delivery event is present', async () => {
    const events = [buildEvent('1', 'TASK_SELECTED', 'SUCCESS')];
    const service = new TrustCenterProjectionService(fakeQueryService(events));

    const trace = await service.getExecutionTrace('task-1');

    expect(trace.selectedProviderId).toBeNull();
    expect(trace.deliveryStatus).toBeNull();
  });

  it('derives workerId from the TASK_EXECUTED event businessContext', async () => {
    const events = [buildEvent('1', 'TASK_EXECUTED', 'SUCCESS', {}, { ...EMPTY_BUSINESS_CONTEXT, workerId: 'worker-default' })];
    const service = new TrustCenterProjectionService(fakeQueryService(events));

    const trace = await service.getExecutionTrace('task-1');

    expect(trace.workerId).toBe('worker-default');
  });

  it('derives geography from whichever event first carries it', async () => {
    const geography = { country: 'Germany', federalState: null, city: 'Berlin', postalCode: null, latitude: null, longitude: null };
    const events = [buildEvent('1', 'TASK_EXECUTED', 'SUCCESS', {}, { ...EMPTY_BUSINESS_CONTEXT, geography })];
    const service = new TrustCenterProjectionService(fakeQueryService(events));

    const trace = await service.getExecutionTrace('task-1');

    expect(trace.geography).toEqual(geography);
  });
});
