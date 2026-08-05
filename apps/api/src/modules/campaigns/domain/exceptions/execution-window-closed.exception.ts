export class ExecutionWindowClosedException extends Error {
  constructor(reason: string) {
    super(`Outside the campaign's execution window: ${reason}`);
    this.name = 'ExecutionWindowClosedException';
  }
}
