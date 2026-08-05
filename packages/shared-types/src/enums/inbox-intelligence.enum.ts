/** M29 — plain string-literal unions, matching this package's own `ConnectedMailboxProvider`
 * precedent: the backend domain layer uses plain TS unions (never Prisma-generated enum types),
 * so a plain union here avoids a cast at every controller boundary for no real type-safety gain. */

/** `ConnectedMailbox.inboxCapabilityStatus` — the separate inbox-reading consent lifecycle,
 * independent of the mailbox's own send-capable `ConnectedMailboxStatus`. */
export type InboxCapabilityStatus =
  | 'NOT_REQUESTED'
  | 'PENDING'
  | 'ACTIVE'
  | 'REAUTHORIZATION_REQUIRED'
  | 'REVOKED'
  | 'USER_DISABLED'
  | 'SYSTEM_SUSPENDED'
  | 'FAILED';

export type CorrelationStatus = 'MATCHED' | 'AMBIGUOUS' | 'UNRELATED' | 'DUPLICATE' | 'UNSAFE_TO_PROCESS';

/** The one approved recruitment reply taxonomy (M29 Phase 9) — every value has a distinct
 * downstream behavior; see `apps/api`'s `reply-taxonomy.ts` for the full rationale. */
export type ReplyPrimaryCategory =
  | 'INTERVIEW_INVITATION'
  | 'ACCEPTANCE_OR_OFFER'
  | 'REJECTION'
  | 'DOCUMENT_REQUEST'
  | 'INFORMATION_REQUEST'
  | 'AVAILABILITY_REQUEST'
  | 'ASSESSMENT_OR_TEST_INVITATION'
  | 'APPLICATION_RECEIVED_CONFIRMATION'
  | 'APPLICATION_UNDER_REVIEW'
  | 'WAITLIST_OR_DELAY'
  | 'REFERRAL_TO_OTHER_POSITION'
  | 'WITHDRAWAL_CONFIRMATION'
  | 'AUTOMATIC_REPLY'
  | 'OUT_OF_OFFICE'
  | 'DELIVERY_FAILURE'
  | 'SPAM_OR_UNRELATED'
  | 'NEEDS_MANUAL_REVIEW'
  | 'UNKNOWN';

export type ReplySecondaryLabel =
  | 'POSITIVE'
  | 'NEGATIVE'
  | 'NEUTRAL'
  | 'ACTION_REQUIRED'
  | 'DEADLINE_PRESENT'
  | 'INTERVIEW_DATE_PRESENT'
  | 'DOCUMENTS_REQUIRED'
  | 'HUMAN_REPLY'
  | 'AUTOMATED_REPLY';

export type ClassificationSource = 'RULE_ENGINE' | 'AI' | 'USER_CORRECTED';

export type InboxMessageReviewStatus = 'PENDING_REVIEW' | 'CONFIRMED' | 'REJECTED' | 'AUTO_ACCEPTED' | 'UNRELATED_CONFIRMED';

export type ProposedApplicationAction =
  | 'REPLY_RECEIVED'
  | 'INTERVIEW_INVITED'
  | 'DOCUMENTS_REQUESTED'
  | 'INFORMATION_REQUESTED'
  | 'ASSESSMENT_INVITED'
  | 'UNDER_REVIEW'
  | 'REJECTED'
  | 'OFFER_RECEIVED'
  | 'WAITING';

export type ApplicationTransitionProposalStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

export type ReplyDraftType =
  | 'INTERVIEW_ACCEPTANCE'
  | 'REQUEST_ALTERNATIVE_TIME'
  | 'DOCUMENT_SUBMISSION_ACKNOWLEDGMENT'
  | 'INFORMATION_RESPONSE'
  | 'POLITE_FOLLOWUP'
  | 'OFFER_ACKNOWLEDGMENT'
  | 'REJECTION_ACKNOWLEDGMENT';

export type ReplyDraftStatus = 'DRAFT' | 'EDITED' | 'APPROVED' | 'SENT' | 'DISCARDED';

export type NotificationKind =
  | 'INTERVIEW_INVITATION'
  | 'OFFER_OR_ACCEPTANCE'
  | 'REJECTION'
  | 'DOCUMENTS_REQUESTED'
  | 'DEADLINE_APPROACHING'
  | 'ASSESSMENT_INVITATION'
  | 'INBOX_CONNECTION_FAILURE'
  | 'REAUTHORIZATION_REQUIRED'
  | 'AMBIGUOUS_REPLY_REVIEW';
