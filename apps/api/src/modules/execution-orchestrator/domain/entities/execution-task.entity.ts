import { Entity } from '../../../../shared/domain';
import { ExecutionStepType } from '../../../execution-planning/domain/execution-blueprint';
import { InvalidTaskStatusTransitionException } from '../exceptions/invalid-task-status-transition.exception';

export type TaskStatus = 'PENDING' | 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'CANCELLED';

const TERMINAL_STATUSES: ReadonlyArray<TaskStatus> = ['COMPLETED', 'FAILED', 'SKIPPED', 'CANCELLED'];

export interface ExecutionTaskProps {
  type: ExecutionStepType;
  title: string;
  explanation: string;
  dependsOn: ReadonlyArray<string>;
  status: TaskStatus;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  failureReason: string | null;
  /** Inherited from the pipeline's own correlationId at task-generation time (M18) — the task's own id then serves as the child/trace id within that same workflow. */
  correlationId: string;
}

/**
 * One executable unit within an ExecutionTaskPipeline — id equals its source
 * ExecutionBlueprint step id, so every task is traceable back to the blueprint without any
 * external lookup. Guards its own status machine exactly like Campaign guards CampaignTarget:
 * the entity protects its own invariants rather than trusting every caller.
 *
 * PENDING -> READY -> RUNNING -> COMPLETED
 *                              -> FAILED
 * PENDING|READY -> SKIPPED (cascaded from a failed dependency)
 * any non-terminal -> CANCELLED
 */
export class ExecutionTask extends Entity<string> {
  private props: ExecutionTaskProps;

  private constructor(id: string, props: ExecutionTaskProps) {
    super(id);
    this.props = props;
  }

  get type(): ExecutionStepType {
    return this.props.type;
  }

  get title(): string {
    return this.props.title;
  }

  get explanation(): string {
    return this.props.explanation;
  }

  get dependsOn(): ReadonlyArray<string> {
    return this.props.dependsOn;
  }

  get status(): TaskStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get startedAt(): Date | null {
    return this.props.startedAt;
  }

  get finishedAt(): Date | null {
    return this.props.finishedAt;
  }

  get failureReason(): string | null {
    return this.props.failureReason;
  }

  get correlationId(): string {
    return this.props.correlationId;
  }

  isTerminal(): boolean {
    return TERMINAL_STATUSES.includes(this.props.status);
  }

  static create(
    stepId: string,
    type: ExecutionStepType,
    title: string,
    explanation: string,
    dependsOn: ReadonlyArray<string>,
    initialStatus: 'PENDING' | 'READY',
    correlationId: string,
    now: Date = new Date(),
  ): ExecutionTask {
    return new ExecutionTask(stepId, {
      type,
      title,
      explanation,
      dependsOn,
      status: initialStatus,
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      failureReason: null,
      correlationId,
    });
  }

  markReady(): void {
    this.guard('PENDING', 'READY');
    this.props.status = 'READY';
  }

  markRunning(now: Date = new Date()): void {
    this.guard('READY', 'RUNNING');
    this.props.status = 'RUNNING';
    this.props.startedAt = now;
  }

  markCompleted(now: Date = new Date()): void {
    this.guard('RUNNING', 'COMPLETED');
    this.props.status = 'COMPLETED';
    this.props.finishedAt = now;
  }

  markFailed(reason: string, now: Date = new Date()): void {
    this.guard('RUNNING', 'FAILED');
    this.props.status = 'FAILED';
    this.props.finishedAt = now;
    this.props.failureReason = reason;
  }

  markSkipped(reason: string, now: Date = new Date()): void {
    if (this.props.status !== 'PENDING' && this.props.status !== 'READY') {
      throw new InvalidTaskStatusTransitionException(this.id, this.props.status, 'SKIPPED');
    }
    this.props.status = 'SKIPPED';
    this.props.finishedAt = now;
    this.props.failureReason = reason;
  }

  markCancelled(now: Date = new Date()): void {
    if (this.isTerminal()) {
      throw new InvalidTaskStatusTransitionException(this.id, this.props.status, 'CANCELLED');
    }
    this.props.status = 'CANCELLED';
    this.props.finishedAt = now;
  }

  private guard(expected: TaskStatus, target: TaskStatus): void {
    if (this.props.status !== expected) {
      throw new InvalidTaskStatusTransitionException(this.id, this.props.status, target);
    }
  }
}
