export type NotificationKind =
  | 'INTERVIEW_INVITATION'
  | 'OFFER_OR_ACCEPTANCE'
  | 'REJECTION'
  | 'DOCUMENTS_REQUESTED'
  | 'DEADLINE_APPROACHING'
  | 'ASSESSMENT_INVITATION'
  | 'INBOX_CONNECTION_FAILURE'
  | 'REAUTHORIZATION_REQUIRED'
  | 'AMBIGUOUS_REPLY_REVIEW'
  // M30 additions.
  | 'FOLLOW_UP_PAUSED'
  | 'FOLLOW_UP_STOPPED'
  | 'FOLLOW_UP_RESUME_AVAILABLE'
  | 'OFFER_REVIEW_REQUIRED'
  | 'MANUAL_REVIEW_REQUIRED'
  | 'TRANSITION_EXECUTION_FAILED'
  | 'TASK_OVERDUE';

/** M29 Phase 18 — the first real, durable, backend-sourced notification in this codebase (Phase 1
 * audit finding: previously only a transient, session-local frontend toast store existed).
 * `dedupeKey` + a DB-level unique constraint on `(userId, dedupeKey)` is the real dedup backstop —
 * "support notification deduplication" enforced by the database, not merely application-code
 * discipline. */
export interface NotificationRecord {
  readonly id: string;
  readonly userId: string;
  readonly kind: NotificationKind;
  readonly relatedInboxMessageId: string | null;
  readonly relatedApplicationId: string | null;
  readonly title: string;
  readonly body: string;
  readonly dedupeKey: string;
  readonly readAt: Date | null;
  readonly createdAt: Date;
}

export interface CreateNotificationInput {
  readonly userId: string;
  readonly kind: NotificationKind;
  readonly relatedInboxMessageId: string | null;
  readonly relatedApplicationId: string | null;
  readonly title: string;
  readonly body: string;
  readonly dedupeKey: string;
}

/** M29 Phase 18 — deliberately separate from inbox consent ("store notification preference
 * separately from inbox consent"): a user can be fully inbox-connected and still turn off, say,
 * deadline reminders, without that affecting whether inbox reading itself is authorized. */
export interface NotificationPreferenceRecord {
  readonly userId: string;
  readonly interviewInvitationEnabled: boolean;
  readonly offerOrAcceptanceEnabled: boolean;
  readonly rejectionEnabled: boolean;
  readonly documentsRequestedEnabled: boolean;
  readonly deadlineApproachingEnabled: boolean;
  readonly assessmentInvitationEnabled: boolean;
  readonly inboxConnectionIssuesEnabled: boolean;
  readonly ambiguousReplyReviewEnabled: boolean;
  readonly followUpControlChangedEnabled: boolean;
  readonly taskDeadlineEnabled: boolean;
  readonly transitionExecutionFailedEnabled: boolean;
}

export const NOTIFICATION_KIND_PREFERENCE_FIELD: Readonly<Record<NotificationKind, keyof Omit<NotificationPreferenceRecord, 'userId'>>> = {
  INTERVIEW_INVITATION: 'interviewInvitationEnabled',
  OFFER_OR_ACCEPTANCE: 'offerOrAcceptanceEnabled',
  REJECTION: 'rejectionEnabled',
  DOCUMENTS_REQUESTED: 'documentsRequestedEnabled',
  DEADLINE_APPROACHING: 'deadlineApproachingEnabled',
  ASSESSMENT_INVITATION: 'assessmentInvitationEnabled',
  INBOX_CONNECTION_FAILURE: 'inboxConnectionIssuesEnabled',
  REAUTHORIZATION_REQUIRED: 'inboxConnectionIssuesEnabled',
  AMBIGUOUS_REPLY_REVIEW: 'ambiguousReplyReviewEnabled',
  FOLLOW_UP_PAUSED: 'followUpControlChangedEnabled',
  FOLLOW_UP_STOPPED: 'followUpControlChangedEnabled',
  FOLLOW_UP_RESUME_AVAILABLE: 'followUpControlChangedEnabled',
  OFFER_REVIEW_REQUIRED: 'offerOrAcceptanceEnabled',
  MANUAL_REVIEW_REQUIRED: 'ambiguousReplyReviewEnabled',
  TRANSITION_EXECUTION_FAILED: 'transitionExecutionFailedEnabled',
  TASK_OVERDUE: 'taskDeadlineEnabled',
};
