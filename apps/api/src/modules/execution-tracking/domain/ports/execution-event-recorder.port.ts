import { ExecutionEventStatus, ExecutionEventType } from '../models/execution-event-type';
import { BusinessContext } from '../models/business-context';

export const EXECUTION_EVENT_RECORDER = Symbol('EXECUTION_EVENT_RECORDER');

export interface RecordExecutionEventInput {
  readonly eventType: ExecutionEventType;
  readonly campaignId: string | null;
  readonly executionId: string | null;
  /** Required (M18) — every recording call site must supply the workflow-wide parent id it belongs to. */
  readonly correlationId: string;
  /** Required (M18) — the most specific unit of work this event belongs to; pass correlationId itself when no narrower id (e.g. a task) exists yet. */
  readonly traceId: string;
  readonly summary: string;
  readonly explanation: string;
  readonly status: ExecutionEventStatus;
  readonly metadata?: Readonly<Record<string, string>>;
  /** Optional — defaults to EMPTY_BUSINESS_CONTEXT when the caller has none of it in scope. */
  readonly businessContext?: BusinessContext;
}

/**
 * The stable port every pipeline step depends on to record what it did.
 * Deliberately fire-and-forget shaped (no return value) — recording an
 * event is an observability side effect, never something a caller branches
 * on.
 */
export interface ExecutionEventRecorder {
  record(input: RecordExecutionEventInput): Promise<void>;
}
