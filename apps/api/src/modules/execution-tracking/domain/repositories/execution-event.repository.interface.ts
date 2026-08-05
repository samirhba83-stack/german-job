import { ExecutionEvent } from '../entities/execution-event.entity';
import { ExecutionEventType } from '../models/execution-event-type';

export const EXECUTION_EVENT_REPOSITORY = Symbol('EXECUTION_EVENT_REPOSITORY');

/**
 * Bespoke, not the generic Repository<T, Id> — events are append-only, so
 * there is no update/delete semantic to expose.
 */
export interface ExecutionEventRepository {
  append(event: ExecutionEvent): Promise<void>;
  findByCampaignId(campaignId: string): Promise<ExecutionEvent[]>;
  findByExecutionId(executionId: string): Promise<ExecutionEvent[]>;
  findRecent(limit: number): Promise<ExecutionEvent[]>;
  /** Added for M17's projections — every event of one type, most recent first. */
  findByEventType(eventType: ExecutionEventType, limit: number): Promise<ExecutionEvent[]>;
  /** Added for M18 — every event sharing one workflow-wide correlation id, chronological. */
  findByCorrelationId(correlationId: string): Promise<ExecutionEvent[]>;
  /** Added for M18 — every event sharing one specific unit-of-work's trace id, chronological. Finer-grained than findByExecutionId: PROVIDER_SELECTED, for example, now shares a task's traceId even though it never carries that task's executionId. */
  findByTraceId(traceId: string): Promise<ExecutionEvent[]>;
  /** Added for M19 — scoped to one campaign AND one trace id together, unlike findByTraceId
   * alone (a bare traceId can recur across unrelated pipeline generations for campaigns that
   * happen to share a blueprint shape — see the M19 report). Used by the Worker's idempotency
   * guard, where a false-positive match against an unrelated campaign would be a real bug. */
  findByCampaignIdAndTraceId(campaignId: string, traceId: string): Promise<ExecutionEvent[]>;
}
