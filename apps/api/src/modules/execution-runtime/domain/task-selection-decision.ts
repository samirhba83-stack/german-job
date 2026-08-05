/** One READY task as it was weighed during selection — present for every candidate considered,
 * not just the winner, so the decision stays fully traceable. */
export interface TaskCandidate {
  readonly taskId: string;
  /** 1 = selected. */
  readonly rank: number;
  readonly explanation: string;
}

/**
 * The Execution Runtime's verdict for one campaign's pipeline: which READY task (if any) should
 * execute next, and why. Advisory only — nothing about a TaskSelectionDecision starts a task;
 * a future Worker is the intended, still-unbuilt consumer that would act on it.
 */
export interface TaskSelectionDecision {
  readonly campaignId: string;
  /** Null when no task should execute right now (nothing READY, or the pipeline isn't ACTIVE). */
  readonly selectedTaskId: string | null;
  readonly reasonCode: string;
  readonly explanation: string;
  readonly candidates: ReadonlyArray<TaskCandidate>;
  /** Carried directly from the pipeline (M18) so Worker/EmailDelivery can keep recording under the same workflow without re-deriving it. */
  readonly correlationId: string;
  readonly userId: string;
}
