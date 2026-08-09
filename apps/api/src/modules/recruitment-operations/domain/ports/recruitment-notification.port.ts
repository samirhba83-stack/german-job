export const RECRUITMENT_NOTIFICATION_PORT = Symbol('RECRUITMENT_NOTIFICATION_PORT');

export type RecruitmentNotificationKind = 'FOLLOW_UP_PAUSED' | 'FOLLOW_UP_STOPPED' | 'FOLLOW_UP_RESUME_AVAILABLE' | 'OFFER_REVIEW_REQUIRED' | 'MANUAL_REVIEW_REQUIRED' | 'TRANSITION_EXECUTION_FAILED' | 'DEADLINE_APPROACHING' | 'TASK_OVERDUE';

export interface RecruitmentNotificationInput {
  readonly userId: string;
  readonly kind: RecruitmentNotificationKind;
  readonly relatedApplicationId: string | null;
  readonly title: string;
  readonly body: string;
  readonly dedupeKey: string;
}

/**
 * M30 — a deliberately minimal, self-contained notification writer scoped to this module.
 * `recruitment-operations` does NOT depend on `inbox-intelligence` (see this module's own doc
 * comment on why: the dependency graph is one-directional in both directions that use it, and
 * `inbox-intelligence` already depends on `recruitment-operations`, so the reverse would cycle).
 * Rather than reach into `inbox-intelligence`'s own `NotificationService`/full 15-kind preference
 * table for that, this port writes to the exact same real `notifications` table (the M29 schema)
 * through its own thin implementation, respecting only the 3 preference fields the M30 schema
 * migration added specifically for these kinds (`followUpControlChangedEnabled`,
 * `taskDeadlineEnabled`, `transitionExecutionFailedEnabled`) — real, DB-enforced dedup via the
 * same `@@unique([userId, dedupeKey])` constraint every other notification write already relies on.
 */
export interface RecruitmentNotificationPort {
  notify(input: RecruitmentNotificationInput): Promise<void>;
}
