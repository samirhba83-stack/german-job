export class InvalidExecutionWindowException extends Error {
  constructor(reason: string) {
    super(`Invalid execution window: ${reason}`);
    this.name = 'InvalidExecutionWindowException';
  }
}
