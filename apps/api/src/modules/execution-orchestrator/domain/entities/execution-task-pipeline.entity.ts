import { AggregateRoot } from '../../../../shared/domain';
import { ExecutionBlueprint } from '../../../execution-planning/domain/execution-blueprint';
import { ExecutionTask } from './execution-task.entity';
import { FailureCascadePolicy } from '../ports/failure-cascade-policy.port';
import { InvalidPipelineStatusTransitionException } from '../exceptions/invalid-pipeline-status-transition.exception';
import { TaskNotFoundException } from '../exceptions/task-not-found.exception';

export type PipelineStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'FINISHED';

export interface ExecutionTaskPipelineProps {
  status: PipelineStatus;
  tasks: ExecutionTask[];
  basedOn: ExecutionBlueprint;
  createdAt: Date;
  updatedAt: Date;
  /** Direct, ergonomic access to the pipeline run's own defining context (M18) — also reachable via basedOn.basedOn.{correlationId,userId}, but the aggregate owns it directly rather than forcing every caller through two levels of embedded objects. */
  correlationId: string;
  userId: string;
}

/**
 * One campaign's executable task graph, derived from its ExecutionBlueprint. The aggregate
 * boundary for orchestration state: every lifecycle transition (start, complete, fail, pause,
 * resume, cancel) goes through here so invariants (a task cannot run before its dependencies
 * complete; nothing progresses once cancelled) are enforced in one place, exactly like Campaign
 * guards its own targets/batches.
 *
 * Readiness resolution (PENDING -> READY once every dependency is COMPLETED) is deterministic
 * dependency-graph reachability with exactly one correct answer, so it stays a private method
 * here rather than a DI port — matching the precedent set by NextExecutionTimeCalculator
 * (Phase 4 M3/M6): pure math is not a swappable business policy. The failure-cascade behavior
 * (what happens to dependents of a failed task), by contrast, genuinely could vary, so it is
 * injected as a FailureCascadePolicy rather than hardcoded here.
 */
export class ExecutionTaskPipeline extends AggregateRoot<string> {
  private props: ExecutionTaskPipelineProps;

  private constructor(campaignId: string, props: ExecutionTaskPipelineProps, private readonly failureCascadePolicy: FailureCascadePolicy) {
    super(campaignId);
    this.props = props;
  }

  get campaignId(): string {
    return this.id;
  }

  get status(): PipelineStatus {
    return this.props.status;
  }

  get tasks(): ReadonlyArray<ExecutionTask> {
    return this.props.tasks;
  }

  get basedOn(): ExecutionBlueprint {
    return this.props.basedOn;
  }

  get correlationId(): string {
    return this.props.correlationId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  static create(
    campaignId: string,
    tasks: ExecutionTask[],
    basedOn: ExecutionBlueprint,
    failureCascadePolicy: FailureCascadePolicy,
    now: Date = new Date(),
  ): ExecutionTaskPipeline {
    const status: PipelineStatus = tasks.length === 0 || tasks.every((task) => task.isTerminal()) ? 'FINISHED' : 'ACTIVE';
    return new ExecutionTaskPipeline(
      campaignId,
      { status, tasks, basedOn, createdAt: now, updatedAt: now, correlationId: basedOn.basedOn.correlationId, userId: basedOn.basedOn.userId },
      failureCascadePolicy,
    );
  }

  findTask(taskId: string): ExecutionTask | null {
    return this.props.tasks.find((task) => task.id === taskId) ?? null;
  }

  getReadyTasks(): ExecutionTask[] {
    return this.props.tasks.filter((task) => task.status === 'READY');
  }

  startTask(taskId: string, now: Date = new Date()): void {
    this.requireActive();
    this.requireTask(taskId).markRunning(now);
    this.touch(now);
  }

  completeTask(taskId: string, now: Date = new Date()): void {
    this.requireNotCancelledOrFinished();
    this.requireTask(taskId).markCompleted(now);
    this.resolveReadiness();
    this.maybeFinish();
    this.touch(now);
  }

  failTask(taskId: string, reason: string, now: Date = new Date()): void {
    this.requireNotCancelledOrFinished();
    const task = this.requireTask(taskId);
    task.markFailed(reason, now);

    const cascaded = this.failureCascadePolicy.cascade(task, this.props.tasks);
    for (const dependent of cascaded) {
      dependent.markSkipped(`Skipped because dependency "${task.id}" failed.`, now);
    }

    this.maybeFinish();
    this.touch(now);
  }

  /** Halts starting NEW tasks; tasks already RUNNING may still be completed or failed — the
   * orchestrator has no power to abort work already in flight, only to decline starting more. */
  pause(now: Date = new Date()): void {
    if (this.props.status !== 'ACTIVE') {
      throw new InvalidPipelineStatusTransitionException(this.campaignId, this.props.status, 'PAUSED');
    }
    this.props.status = 'PAUSED';
    this.touch(now);
  }

  /** Re-resolves readiness on resume, since tasks that finished while paused may have unblocked
   * dependents that were held back (see resolveReadiness's early return while PAUSED). */
  resume(now: Date = new Date()): void {
    if (this.props.status !== 'PAUSED') {
      throw new InvalidPipelineStatusTransitionException(this.campaignId, this.props.status, 'ACTIVE');
    }
    this.props.status = 'ACTIVE';
    this.resolveReadiness();
    this.maybeFinish();
    this.touch(now);
  }

  /** Terminal — cancels every non-terminal task; there is no real in-flight external work to
   * abort at this layer (nothing here has ever touched infrastructure), so cancellation is
   * immediate and total. */
  cancel(now: Date = new Date()): void {
    if (this.props.status === 'CANCELLED' || this.props.status === 'FINISHED') {
      throw new InvalidPipelineStatusTransitionException(this.campaignId, this.props.status, 'CANCELLED');
    }
    for (const task of this.props.tasks) {
      if (!task.isTerminal()) {
        task.markCancelled(now);
      }
    }
    this.props.status = 'CANCELLED';
    this.touch(now);
  }

  private resolveReadiness(): void {
    if (this.props.status === 'PAUSED') {
      return;
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const task of this.props.tasks) {
        if (task.status !== 'PENDING') {
          continue;
        }
        const dependenciesCompleted = task.dependsOn.every((depId) => this.findTask(depId)?.status === 'COMPLETED');
        if (dependenciesCompleted) {
          task.markReady();
          changed = true;
        }
      }
    }
  }

  private maybeFinish(): void {
    if (this.props.status === 'ACTIVE' && this.props.tasks.every((task) => task.isTerminal())) {
      this.props.status = 'FINISHED';
    }
  }

  private requireTask(taskId: string): ExecutionTask {
    const task = this.findTask(taskId);
    if (!task) {
      throw new TaskNotFoundException(taskId);
    }
    return task;
  }

  private requireActive(): void {
    if (this.props.status !== 'ACTIVE') {
      throw new InvalidPipelineStatusTransitionException(this.campaignId, this.props.status, 'ACTIVE');
    }
  }

  private requireNotCancelledOrFinished(): void {
    if (this.props.status === 'CANCELLED' || this.props.status === 'FINISHED') {
      throw new InvalidPipelineStatusTransitionException(this.campaignId, this.props.status, this.props.status);
    }
  }

  private touch(now: Date): void {
    this.props.updatedAt = now;
  }
}
