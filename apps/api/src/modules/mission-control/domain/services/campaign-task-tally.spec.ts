import { tallyTaskExecutionsByCampaign } from './campaign-task-tally';
import { ExecutionEvent } from '../../../execution-tracking/domain/entities/execution-event.entity';
import { ExecutionEventType, ExecutionEventStatus } from '../../../execution-tracking/domain/models/execution-event-type';
import { EMPTY_BUSINESS_CONTEXT } from '../../../execution-tracking/domain/models/business-context';

let counter = 0;

function buildEvent(overrides: {
  eventType?: ExecutionEventType;
  campaignId?: string | null;
  status?: ExecutionEventStatus;
  occurredAt?: Date;
}): ExecutionEvent {
  counter += 1;
  return ExecutionEvent.create(`event-${counter}`, {
    eventType: overrides.eventType ?? 'TASK_EXECUTED',
    campaignId: overrides.campaignId === undefined ? 'campaign-1' : overrides.campaignId,
    executionId: 'task-1',
    correlationId: 'correlation-1',
    traceId: 'task-1',
    summary: 'summary',
    explanation: 'explanation',
    status: overrides.status ?? 'SUCCESS',
    metadata: {},
    businessContext: EMPTY_BUSINESS_CONTEXT,
    occurredAt: overrides.occurredAt ?? new Date('2026-01-05T10:00:00.000Z'),
  });
}

describe('tallyTaskExecutionsByCampaign', () => {
  it('counts successes and failures per campaign', () => {
    const events = [
      buildEvent({ campaignId: 'campaign-1', status: 'SUCCESS' }),
      buildEvent({ campaignId: 'campaign-1', status: 'FAILURE' }),
      buildEvent({ campaignId: 'campaign-2', status: 'SUCCESS' }),
    ];

    const tallies = tallyTaskExecutionsByCampaign(events);

    expect(tallies).toEqual([
      { campaignId: 'campaign-1', tasksExecuted: 2, tasksSucceeded: 1, tasksFailed: 1, lastActivityAt: expect.any(Date) },
      { campaignId: 'campaign-2', tasksExecuted: 1, tasksSucceeded: 1, tasksFailed: 0, lastActivityAt: expect.any(Date) },
    ]);
  });

  it('ignores non-TASK_EXECUTED events', () => {
    const events = [buildEvent({ eventType: 'DECISION_MADE' }), buildEvent({ eventType: 'TASK_EXECUTED' })];

    const tallies = tallyTaskExecutionsByCampaign(events);

    expect(tallies).toHaveLength(1);
    expect(tallies[0].tasksExecuted).toBe(1);
  });

  it('ignores events with a null campaignId', () => {
    const events = [buildEvent({ campaignId: null })];

    const tallies = tallyTaskExecutionsByCampaign(events);

    expect(tallies).toEqual([]);
  });

  it('tracks the most recent occurredAt as lastActivityAt', () => {
    const older = buildEvent({ occurredAt: new Date('2026-01-01T00:00:00.000Z') });
    const newer = buildEvent({ occurredAt: new Date('2026-01-10T00:00:00.000Z') });

    const [tally] = tallyTaskExecutionsByCampaign([older, newer]);

    expect(tally.lastActivityAt).toEqual(new Date('2026-01-10T00:00:00.000Z'));
  });

  it('sorts results by campaignId for determinism', () => {
    const events = [buildEvent({ campaignId: 'zebra' }), buildEvent({ campaignId: 'alpha' })];

    const tallies = tallyTaskExecutionsByCampaign(events);

    expect(tallies.map((t) => t.campaignId)).toEqual(['alpha', 'zebra']);
  });

  it('returns an empty array for an empty event list', () => {
    expect(tallyTaskExecutionsByCampaign([])).toEqual([]);
  });
});
