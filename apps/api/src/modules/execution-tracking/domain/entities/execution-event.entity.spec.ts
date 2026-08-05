import { ExecutionEvent } from './execution-event.entity';
import { EMPTY_BUSINESS_CONTEXT } from '../models/business-context';

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000';
const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildProps(overrides: Partial<Parameters<typeof ExecutionEvent.create>[1]> = {}) {
  return {
    eventType: 'TASK_EXECUTED' as const,
    campaignId: 'campaign-1',
    executionId: 'execution-1',
    correlationId: 'correlation-1',
    traceId: 'trace-1',
    summary: 'Task executed successfully',
    explanation: 'The worker executed the selected task and it completed.',
    status: 'SUCCESS' as const,
    metadata: {},
    businessContext: EMPTY_BUSINESS_CONTEXT,
    occurredAt: NOW,
    ...overrides,
  };
}

describe('ExecutionEvent', () => {
  it('creates an event exposing every field', () => {
    const event = ExecutionEvent.create(VALID_ID, buildProps());

    expect(event.id).toBe(VALID_ID);
    expect(event.eventType).toBe('TASK_EXECUTED');
    expect(event.campaignId).toBe('campaign-1');
    expect(event.executionId).toBe('execution-1');
    expect(event.summary).toBe('Task executed successfully');
    expect(event.status).toBe('SUCCESS');
    expect(event.occurredAt).toBe(NOW);
    expect(event.correlationId).toBe('correlation-1');
    expect(event.traceId).toBe('trace-1');
    expect(event.businessContext).toBe(EMPTY_BUSINESS_CONTEXT);
  });

  it('rejects an empty summary', () => {
    expect(() => ExecutionEvent.create(VALID_ID, buildProps({ summary: '   ' }))).toThrow(/summary/);
  });

  it('rejects an empty explanation', () => {
    expect(() => ExecutionEvent.create(VALID_ID, buildProps({ explanation: '   ' }))).toThrow(/explanation/);
  });

  it('rejects an empty correlationId', () => {
    expect(() => ExecutionEvent.create(VALID_ID, buildProps({ correlationId: '   ' }))).toThrow(/correlationId/);
  });

  it('rejects an empty traceId', () => {
    expect(() => ExecutionEvent.create(VALID_ID, buildProps({ traceId: '   ' }))).toThrow(/traceId/);
  });

  it('allows a null campaignId and executionId', () => {
    const event = ExecutionEvent.create(VALID_ID, buildProps({ campaignId: null, executionId: null }));

    expect(event.campaignId).toBeNull();
    expect(event.executionId).toBeNull();
  });

  it('exposes no mutation methods — every field is read-only after creation', () => {
    const event = ExecutionEvent.create(VALID_ID, buildProps());

    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(event))).not.toEqual(
      expect.arrayContaining(['update', 'markCompleted', 'markFailed']),
    );
  });

  it('reconstitute rehydrates an event identically to create for the same props', () => {
    const props = buildProps();

    const created = ExecutionEvent.create(VALID_ID, props);
    const reconstituted = ExecutionEvent.reconstitute(VALID_ID, props);

    expect(reconstituted.id).toBe(created.id);
    expect(reconstituted.summary).toBe(created.summary);
    expect(reconstituted.status).toBe(created.status);
  });

  it('treats two events with the same id as equal', () => {
    const a = ExecutionEvent.create(VALID_ID, buildProps());
    const b = ExecutionEvent.create(VALID_ID, buildProps({ summary: 'different summary' }));

    expect(a.equals(b)).toBe(true);
  });
});
