import { InboxWatchRecord, CreateInboxWatchInput, InboxWatchUpdatePatch } from '../models/inbox-watch';

export const INBOX_WATCH_REPOSITORY = Symbol('INBOX_WATCH_REPOSITORY');

export interface InboxWatchRepository {
  findByConnectedMailboxId(connectedMailboxId: string): Promise<InboxWatchRecord | null>;
  /** The real lookup a Microsoft Graph change notification needs — it identifies itself only by
   * `subscriptionId` (this application's own `providerWatchId`), never by mailbox email. */
  findByProviderWatchId(providerWatchId: string): Promise<InboxWatchRecord | null>;
  /** One watch per mailbox — a repeat call for an already-watched mailbox replaces the existing
   * row's fields rather than creating a second one (real DB-level `@unique` backstop on
   * `connectedMailboxId`). */
  upsert(input: CreateInboxWatchInput, now: Date): Promise<InboxWatchRecord>;
  update(id: string, patch: InboxWatchUpdatePatch, now: Date): Promise<InboxWatchRecord>;
  /** Phase 5 renewal-job query: every watch expiring within the given horizon. */
  listExpiringBefore(cutoff: Date, limit: number): Promise<InboxWatchRecord[]>;
}
