/**
 * M30 Phase 11 — the one real projection surfacing reply/classification/follow-up/task state
 * together, per the brief's own explicit ask. Deliberately a documented EXCEPTION to this
 * module's original M17 "purely from persisted execution events" rule: none of this data
 * (a reply's classification, an active follow-up control, an open recruitment task) has any
 * ExecutionEvent equivalent to project from — `MissionControlModule`'s own doc comment has been
 * updated to reflect this real, justified exception rather than silently violating the original
 * rule it stated. Still strictly read-only: no field here is ever computed by mutating anything.
 */
export interface ReplyFollowUpOverview {
  readonly applicationId: string;
  readonly latestReply: {
    readonly inboxMessageId: string;
    readonly fromAddress: string;
    readonly subject: string;
    readonly receivedAt: Date;
    readonly primaryCategory: string | null;
    readonly confidence: number | null;
  } | null;
  readonly activeFollowUpControl: {
    readonly controlType: string;
    readonly reasonCode: string;
    readonly explanation: string;
    readonly expiresAt: Date | null;
  } | null;
  readonly pendingTransitionProposal: {
    readonly id: string;
    readonly proposedAction: string;
    readonly confidence: number | null;
  } | null;
  readonly openTasks: ReadonlyArray<{
    readonly id: string;
    readonly taskType: string;
    readonly title: string;
    readonly dueAt: Date | null;
    readonly dueDateConfidence: string | null;
  }>;
}
