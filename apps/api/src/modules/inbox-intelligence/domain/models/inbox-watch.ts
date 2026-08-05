import { ConnectedMailboxProvider } from '../../../connected-mailbox/domain/models/connected-mailbox';

export type InboxWatchStatus = 'ACTIVE' | 'EXPIRED' | 'STOPPED' | 'FAILED';

/** M29 Phase 5 — one real provider-native change-notification registration per inbox-enabled
 * mailbox. `historyCursor` is what makes bounded gap-recovery possible: Gmail's own `historyId`,
 * or Graph's own delta/skip token — persisted so a missed-notification recovery pass knows
 * exactly where it last left off rather than re-scanning the whole mailbox. */
export interface InboxWatchRecord {
  readonly id: string;
  readonly connectedMailboxId: string;
  readonly provider: ConnectedMailboxProvider;
  readonly status: InboxWatchStatus;
  readonly providerWatchId: string | null;
  readonly historyCursor: string | null;
  readonly expiresAt: Date | null;
  readonly lastRenewedAt: Date | null;
  readonly lastNotificationAt: Date | null;
  readonly consecutiveFailureCount: number;
  readonly lastFailureReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateInboxWatchInput {
  readonly connectedMailboxId: string;
  readonly provider: ConnectedMailboxProvider;
  readonly providerWatchId: string | null;
  readonly historyCursor: string | null;
  readonly expiresAt: Date | null;
}

export interface InboxWatchUpdatePatch {
  readonly status?: InboxWatchStatus;
  readonly providerWatchId?: string | null;
  readonly historyCursor?: string | null;
  readonly expiresAt?: Date | null;
  readonly lastRenewedAt?: Date;
  readonly lastNotificationAt?: Date;
  readonly consecutiveFailureCount?: number;
  readonly lastFailureReason?: string | null;
}
