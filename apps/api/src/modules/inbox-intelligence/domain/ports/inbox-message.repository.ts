import { InboxMessageRecord, CreateInboxMessageInput, InboxMessageClassificationPatch, InboxMessageReviewPatch } from '../models/inbox-message';

export const INBOX_MESSAGE_REPOSITORY = Symbol('INBOX_MESSAGE_REPOSITORY');

export interface InboxMessageListFilter {
  readonly connectedMailboxId?: string;
  readonly userId?: string; // resolved via the owning ConnectedMailbox, never a raw cross-user query
  readonly reviewStatus?: string;
  readonly correlationStatus?: string;
  readonly correlatedApplicationId?: string;
}

export interface InboxMessageRepository {
  findById(id: string): Promise<InboxMessageRecord | null>;
  /** The real idempotency backstop for provider-notification replay (Phase 5/21: "notification
   * replay is idempotent") — a redelivered push notification for the same message can never
   * create a second row; enforced by a real DB-level unique constraint on
   * `(connectedMailboxId, providerMessageId)`, not merely an application-level check-then-insert. */
  create(input: CreateInboxMessageInput, now: Date): Promise<InboxMessageRecord>;
  findByConnectedMailboxIdAndProviderMessageId(connectedMailboxId: string, providerMessageId: string): Promise<InboxMessageRecord | null>;
  applyClassification(id: string, patch: InboxMessageClassificationPatch, now: Date): Promise<InboxMessageRecord>;
  updateReviewStatus(id: string, patch: InboxMessageReviewPatch, now: Date): Promise<InboxMessageRecord>;
  list(filter: InboxMessageListFilter, limit: number, offset: number): Promise<InboxMessageRecord[]>;
  /** M29 Phase 20 retention — messages whose `createdAt` is older than the cutoff, for the
   * retention job to prune down to the minimal audit-required shape. */
  listOlderThan(cutoff: Date, limit: number): Promise<InboxMessageRecord[]>;
  pruneToMinimalRecord(id: string, now: Date): Promise<void>;
}
