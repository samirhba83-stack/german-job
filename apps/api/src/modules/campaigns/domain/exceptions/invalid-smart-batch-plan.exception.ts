export class InvalidSmartBatchPlanException extends Error {
  constructor(reason: string) {
    super(`Invalid smart batch plan: ${reason}`);
    this.name = 'InvalidSmartBatchPlanException';
  }
}
