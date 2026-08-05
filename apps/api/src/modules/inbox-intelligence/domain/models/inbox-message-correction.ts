export type InboxMessageCorrectionType = 'CLASSIFICATION' | 'EXTRACTED_FACTS' | 'CORRELATION' | 'UNRELATED_MARK';

/** M29 Phase 19 — "never overwrite the historical automated result": a correction is always a NEW
 * row, never an in-place mutation of `InboxMessageRecord`'s own classification/extraction fields. */
export interface InboxMessageCorrectionRecord {
  readonly id: string;
  readonly inboxMessageId: string;
  readonly correctionType: InboxMessageCorrectionType;
  readonly originalValue: Readonly<Record<string, unknown>>;
  readonly correctedValue: Readonly<Record<string, unknown>>;
  readonly correctedByUserId: string;
  readonly reason: string | null;
  readonly createdAt: Date;
}

export interface CreateInboxMessageCorrectionInput {
  readonly inboxMessageId: string;
  readonly correctionType: InboxMessageCorrectionType;
  readonly originalValue: Readonly<Record<string, unknown>>;
  readonly correctedValue: Readonly<Record<string, unknown>>;
  readonly correctedByUserId: string;
  readonly reason: string | null;
}
