export class TaskNotFoundException extends Error {
  constructor(taskId: string) {
    super(`No execution task found with id "${taskId}"`);
    this.name = 'TaskNotFoundException';
  }
}
