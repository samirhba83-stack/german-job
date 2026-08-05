export type ExecutionOutcomeStatus = 'COMPLETED' | 'FAILED';

/**
 * The Worker's explainable record of executing exactly one task. Produced once per
 * WorkerService.execute() call — the Worker never batches, never summarizes across tasks.
 */
export interface ExecutionResult {
  readonly campaignId: string;
  readonly taskId: string;
  readonly status: ExecutionOutcomeStatus;
  readonly durationMs: number;
  readonly executedAt: Date;
  readonly reason: string;
  /** Null unless status is FAILED. */
  readonly failureReason: string | null;
  /** Carried from the executed task's own correlationId (M18). */
  readonly correlationId: string;
}
