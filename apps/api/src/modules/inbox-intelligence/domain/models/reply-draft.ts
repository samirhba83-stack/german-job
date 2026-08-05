export type ReplyDraftType =
  | 'INTERVIEW_ACCEPTANCE'
  | 'REQUEST_ALTERNATIVE_TIME'
  | 'DOCUMENT_SUBMISSION_ACKNOWLEDGMENT'
  | 'INFORMATION_RESPONSE'
  | 'POLITE_FOLLOWUP'
  | 'OFFER_ACKNOWLEDGMENT'
  | 'REJECTION_ACKNOWLEDGMENT';

export type ReplyDraftStatus = 'DRAFT' | 'EDITED' | 'APPROVED' | 'SENT' | 'DISCARDED';

export interface ReplyDraftPlaceholder {
  readonly label: string;
  readonly filled: boolean;
}

/** M29 Phase 16 — "never send automatically... require explicit user review and click-to-send."
 * `status` only ever reaches `SENT` after `ConnectedMailboxSendService` succeeds, triggered by an
 * explicit user approval action — never by any automated code path. */
export interface ReplyDraftRecord {
  readonly id: string;
  readonly inboxMessageId: string;
  readonly applicationId: string;
  readonly connectedMailboxId: string;
  readonly draftType: ReplyDraftType;
  readonly subject: string;
  readonly bodyText: string;
  readonly placeholders: ReadonlyArray<ReplyDraftPlaceholder>;
  readonly status: ReplyDraftStatus;
  readonly approvedByUserId: string | null;
  readonly approvedAt: Date | null;
  readonly sentConnectedMailboxSendAttemptId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateReplyDraftInput {
  readonly inboxMessageId: string;
  readonly applicationId: string;
  readonly connectedMailboxId: string;
  readonly draftType: ReplyDraftType;
  readonly subject: string;
  readonly bodyText: string;
  readonly placeholders: ReadonlyArray<ReplyDraftPlaceholder>;
}

export interface ReplyDraftUpdatePatch {
  readonly subject?: string;
  readonly bodyText?: string;
  readonly placeholders?: ReadonlyArray<ReplyDraftPlaceholder>;
  readonly status?: ReplyDraftStatus;
  readonly approvedByUserId?: string | null;
  readonly approvedAt?: Date | null;
  readonly sentConnectedMailboxSendAttemptId?: string | null;
}
