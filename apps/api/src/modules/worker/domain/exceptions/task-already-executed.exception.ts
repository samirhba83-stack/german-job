export class TaskAlreadyExecutedException extends Error {
  constructor(taskId: string) {
    super(`Task "${taskId}" has already completed successfully — refusing to execute it again.`);
    this.name = 'TaskAlreadyExecutedException';
  }
}
