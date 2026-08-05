import { Entity } from '../../../../shared/domain';
import { ExecutionEventStatus, ExecutionEventType } from '../models/execution-event-type';
import { BusinessContext } from '../models/business-context';

export interface ExecutionEventProps {
  eventType: ExecutionEventType;
  campaignId: string | null;
  executionId: string | null;
  /** Parent id: shared by every event belonging to one campaign's pipeline run (M18). */
  correlationId: string;
  /** Child id: narrows to the current unit of work — equals correlationId for
   * campaign-level-only events (no task exists yet), equals the task id once
   * one does. Never null, so "what's the most specific thing this event
   * belongs to" is always answerable without a fallback. */
  traceId: string;
  summary: string;
  explanation: string;
  status: ExecutionEventStatus;
  metadata: Readonly<Record<string, string>>;
  businessContext: BusinessContext;
  occurredAt: Date;
}

/**
 * An immutable fact: something the platform did or observed. Unlike every
 * other Entity/AggregateRoot in this codebase, ExecutionEvent has no
 * mutation methods at all — once created it is only ever appended and read,
 * never updated or deleted, matching the append-only event-log semantics
 * of TimelineEntry/DispatchAttempt in the Prisma schema.
 */
export class ExecutionEvent extends Entity<string> {
  private readonly props: ExecutionEventProps;

  private constructor(id: string, props: ExecutionEventProps) {
    super(id);
    this.props = props;
  }

  get eventType(): ExecutionEventType {
    return this.props.eventType;
  }

  get campaignId(): string | null {
    return this.props.campaignId;
  }

  get executionId(): string | null {
    return this.props.executionId;
  }

  get correlationId(): string {
    return this.props.correlationId;
  }

  get traceId(): string {
    return this.props.traceId;
  }

  get summary(): string {
    return this.props.summary;
  }

  get explanation(): string {
    return this.props.explanation;
  }

  get status(): ExecutionEventStatus {
    return this.props.status;
  }

  get metadata(): Readonly<Record<string, string>> {
    return this.props.metadata;
  }

  get businessContext(): BusinessContext {
    return this.props.businessContext;
  }

  get occurredAt(): Date {
    return this.props.occurredAt;
  }

  static create(id: string, props: ExecutionEventProps): ExecutionEvent {
    if (!props.summary.trim()) {
      throw new Error('Execution event requires a summary');
    }
    if (!props.explanation.trim()) {
      throw new Error('Execution event requires an explanation');
    }
    if (!props.correlationId.trim()) {
      throw new Error('Execution event requires a correlationId');
    }
    if (!props.traceId.trim()) {
      throw new Error('Execution event requires a traceId');
    }

    return new ExecutionEvent(id, props);
  }

  /** Rehydrates an ExecutionEvent from persistence. */
  static reconstitute(id: string, props: ExecutionEventProps): ExecutionEvent {
    return new ExecutionEvent(id, props);
  }
}
