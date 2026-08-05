import { TaskStatus } from '../../../execution-orchestrator/domain/entities/execution-task.entity';

export class TaskNotExecutableException extends Error {
  constructor(taskId: string, actualStatus: TaskStatus) {
    super(`Task "${taskId}" is not executable — expected status READY but found ${actualStatus}.`);
    this.name = 'TaskNotExecutableException';
  }
}
