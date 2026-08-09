/** M30 — plain string-literal unions, matching this package's own established convention (see
 * `inbox-intelligence.enum.ts`'s identical precedent). */
export type FollowUpControlType = 'TEMPORARY_HOLD' | 'PERMANENT_SUPPRESSION' | 'WAITING_PERIOD' | 'MANUAL_REVIEW_HOLD' | 'DELIVERABILITY_BLOCK';

export type FollowUpControlStatus = 'ACTIVE' | 'RELEASED' | 'EXPIRED' | 'SUPERSEDED';

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

export type RecruitmentTaskPriority = 'LOW' | 'NORMAL' | 'HIGH';

export type DueDateConfidence = 'RELIABLE' | 'AMBIGUOUS';
