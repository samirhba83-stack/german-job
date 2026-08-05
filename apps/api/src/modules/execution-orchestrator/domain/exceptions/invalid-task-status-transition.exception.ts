import { TaskStatus } from '../entities/execution-task.entity';

export class InvalidTaskStatusTransitionException extends Error {
  constructor(taskId: string, from: TaskStatus, to: TaskStatus) {
    super(`Cannot transition task "${taskId}" from ${from} to ${to}`);
    this.name = 'InvalidTaskStatusTransitionException';
  }
}
