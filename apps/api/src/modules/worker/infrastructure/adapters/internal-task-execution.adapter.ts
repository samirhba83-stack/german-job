import { Injectable } from '@nestjs/common';
import { ExecutionTask } from '../../../execution-orchestrator/domain/entities/execution-task.entity';
import { TaskExecutionOutcome, TaskExecutionPort } from '../../domain/ports/task-execution.port';

/**
 * Default TASK_EXECUTION_PORT binding for this milestone. Deliberately infrastructure-free: it
 * performs no I/O, no network call, no SMTP/Gmail/Microsoft Graph integration — it deterministically
 * simulates success for every task. This is the slot a real provider adapter plugs into in a
 * future milestone, without any change to WorkerService.
 */
@Injectable()
export class InternalTaskExecutionAdapter implements TaskExecutionPort {
  async execute(task: ExecutionTask): Promise<TaskExecutionOutcome> {
    return {
      success: true,
      reason: `Task "${task.id}" (${task.type}) executed via the internal simulation adapter; no external provider is configured yet.`,
      failureReason: null,
    };
  }
}
