/**
 * "Regional Progress" as speced (per-German-city breakdown) is not
 * derivable from the event log — no ExecutionEvent carries a region. This
 * is the honest substitute: progress grouped by the one real dimension
 * TASK_EXECUTED events carry, campaignId. region is included, always null,
 * as a forward-compatible placeholder for whichever future milestone
 * threads geographic data into recorded events (matching the
 * MotivationLetterSource: 'NOT_AVAILABLE' precedent from M14).
 */
export interface CampaignProgress {
  readonly campaignId: string;
  readonly region: string | null;
  readonly tasksExecuted: number;
  readonly tasksSucceeded: number;
  readonly tasksFailed: number;
  readonly completionPercentage: number;
  readonly lastActivityAt: Date;
}
