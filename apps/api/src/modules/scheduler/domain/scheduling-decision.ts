/**
 * The Scheduler's verdict for a single campaign at a given instant. Always produced — for
 * ineligible campaigns too — so callers get an explained reason instead of a silent omission.
 */
export interface SchedulingDecision {
  readonly campaignId: string;
  readonly eligible: boolean;
  readonly reasonCode: string;
  readonly explanation: string;
  /** Deterministic execution-order score among eligible campaigns; 0 when not eligible. */
  readonly priority: number;
  /** Batch size the Scheduler would recommend right now; 0 when not eligible. */
  readonly plannedBatchSize: number;
  /**
   * Earliest instant this campaign is expected to become eligible again. `now` when already
   * eligible; `null` when not computable (campaign not RUNNING, no pending targets, or blocked
   * by the daily rate limit — see NextExecutionTimeCalculator for why rate-limit recovery time
   * isn't modeled here).
   */
  readonly nextExecutionAt: Date | null;
}
