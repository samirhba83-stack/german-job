import { ExecutionTask } from '../../../execution-orchestrator/domain/entities/execution-task.entity';

export const TASK_EXECUTION_PORT = Symbol('TASK_EXECUTION_PORT');

export interface TaskExecutionOutcome {
  readonly success: boolean;
  /** Human-readable account of what happened — populated whether the task succeeded or failed. */
  readonly reason: string;
  /** Populated only when success is false. */
  readonly failureReason: string | null;
}

/**
 * The Worker's sole extension point: performs the actual work a task represents. This
 * milestone's binding (InternalTaskExecutionAdapter) is an internal simulation only — no SMTP,
 * no Gmail API, no Microsoft Graph, no network call of any kind. Future milestones plug real
 * providers in here via a different DI binding; WorkerService never changes either way.
 */
export interface TaskExecutionPort {
  execute(task: ExecutionTask): Promise<TaskExecutionOutcome>;
}
