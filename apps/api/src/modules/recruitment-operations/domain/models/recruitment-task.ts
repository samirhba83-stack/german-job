export type RecruitmentTaskType =
  | 'CONFIRM_INTERVIEW'
  | 'SELECT_INTERVIEW_SLOT'
  | 'PREPARE_INTERVIEW'
  | 'UPLOAD_REQUESTED_DOCUMENT'
  | 'SEND_REQUESTED_DOCUMENT'
  | 'PROVIDE_INFORMATION'
  | 'COMPLETE_ASSESSMENT'
  | 'REVIEW_OFFER'
  | 'FOLLOW_UP_AFTER_DATE'
  | 'MANUAL_REPLY_REVIEW'
  | 'REAUTHORIZE_INBOX'
  | 'RECONNECT_MAILBOX';

export type RecruitmentTaskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED' | 'EXPIRED';

/** M30 Phase 8 — the first user-facing recruitment task/action-item concept in this codebase
 * (Phase 1 audit: no prior art exists anywhere). `dueAt` is only ever set from a real, unambiguous
 * extracted date (Phase 9) — an ambiguous date is preserved as `originalDateText` with
 * `dueDateConfidence: 'AMBIGUOUS'` and no `dueAt`, requiring the user to confirm it themselves
 * before this task carries any deadline notification. */
export interface RecruitmentTaskRecord {
  readonly id: string;
  readonly userId: string;
  readonly applicationId: string;
  readonly companyId: string | null;
  readonly jobId: string | null;

  readonly sourceInboxMessageId: string | null;

  readonly taskType: RecruitmentTaskType;
  readonly title: string;
  readonly explanation: string;
  readonly evidence: Readonly<Record<string, unknown>> | null;
  readonly priority: 'LOW' | 'NORMAL' | 'HIGH';

  readonly dueAt: Date | null;
  readonly dueDateConfidence: 'RELIABLE' | 'AMBIGUOUS' | null;
  readonly originalDateText: string | null;

  readonly status: RecruitmentTaskStatus;
  readonly completedAt: Date | null;
  readonly dismissedAt: Date | null;
  readonly dismissReason: string | null;

  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly correlationId: string | null;
  readonly idempotencyKey: string;
}

export interface CreateRecruitmentTaskInput {
  readonly userId: string;
  readonly applicationId: string;
  readonly companyId: string | null;
  readonly jobId: string | null;
  readonly sourceInboxMessageId: string | null;
  readonly taskType: RecruitmentTaskType;
  readonly title: string;
  readonly explanation: string;
  readonly evidence: Readonly<Record<string, unknown>> | null;
  readonly priority: 'LOW' | 'NORMAL' | 'HIGH';
  readonly dueAt: Date | null;
  readonly dueDateConfidence: 'RELIABLE' | 'AMBIGUOUS' | null;
  readonly originalDateText: string | null;
  readonly correlationId: string | null;
  /** Deterministic per (sourceInboxMessageId, taskType) — the real defense against duplicate
   * tasks from a duplicate provider event (Non-Negotiable Principle #9). */
  readonly idempotencyKey: string;
}
