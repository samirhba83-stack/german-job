import { ExecutionEvent } from '../../../execution-tracking/domain/entities/execution-event.entity';

export interface CampaignTaskTally {
  readonly campaignId: string;
  readonly tasksExecuted: number;
  readonly tasksSucceeded: number;
  readonly tasksFailed: number;
  readonly lastActivityAt: Date;
}

/**
 * Groups TASK_EXECUTED events by campaignId — the shared computation behind
 * both GermanyCoverageProjectionService and RegionalProgressProjectionService,
 * which both need the same per-campaign tallies. Deterministic, no
 * framework dependency, no genuine alternative algorithm (plain grouping),
 * so this stays a plain function rather than a DI-injected strategy —
 * same reasoning as NextExecutionTimeCalculator.
 */
export function tallyTaskExecutionsByCampaign(events: ReadonlyArray<ExecutionEvent>): CampaignTaskTally[] {
  const tallies = new Map<string, { tasksExecuted: number; tasksSucceeded: number; tasksFailed: number; lastActivityAt: Date }>();

  for (const event of events) {
    if (event.eventType !== 'TASK_EXECUTED' || event.campaignId === null) {
      continue;
    }

    const existing = tallies.get(event.campaignId) ?? { tasksExecuted: 0, tasksSucceeded: 0, tasksFailed: 0, lastActivityAt: event.occurredAt };
    existing.tasksExecuted += 1;
    if (event.status === 'SUCCESS') {
      existing.tasksSucceeded += 1;
    } else {
      existing.tasksFailed += 1;
    }
    if (event.occurredAt.getTime() > existing.lastActivityAt.getTime()) {
      existing.lastActivityAt = event.occurredAt;
    }
    tallies.set(event.campaignId, existing);
  }

  return [...tallies.entries()]
    .map(([campaignId, tally]) => ({ campaignId, ...tally }))
    .sort((a, b) => a.campaignId.localeCompare(b.campaignId));
}
