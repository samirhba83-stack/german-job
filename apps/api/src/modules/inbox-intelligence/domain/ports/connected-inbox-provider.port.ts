import { ConnectedMailboxProvider } from '../../../connected-mailbox/domain/models/connected-mailbox';
import { ChangedMessageRef, ProviderInboxMessageContent, ProviderInboxMessageMetadata } from '../models/provider-inbox-message';

export const CONNECTED_INBOX_PROVIDERS = Symbol('CONNECTED_INBOX_PROVIDERS');

export interface RegisterWatchResult {
  readonly providerWatchId: string | null; // Graph subscription id; null for Gmail (no separate id)
  readonly historyCursor: string;
  readonly expiresAt: Date;
}

export interface FetchChangesResult {
  readonly changedMessages: ReadonlyArray<ChangedMessageRef>;
  readonly newHistoryCursor: string;
  /** True when the provider reports the starting cursor is too old to resume from (Gmail:
   * `404 historyId not found`; Graph: an expired/invalid delta token) — the real signal that
   * triggers Phase 5's bounded recovery-polling path instead of an ordinary incremental fetch. */
  readonly cursorTooOld: boolean;
}

export interface ThrottleInfo {
  readonly throttled: boolean;
  readonly retryAfterMs: number | null;
}

/**
 * M29 Phase 4 — the one provider-independent inbox-reading abstraction, deliberately separate
 * from `ConnectedMailboxProviderPort` (M28.6): that port models sending on a real user's own
 * behalf with send-only credentials; this port models READING a real user's own mailbox with a
 * separate, narrower, explicitly-upgraded consent — different trust boundary, different data
 * sensitivity, never unified into one ambiguous interface (matching M28.6's own precedent of
 * keeping `EmailProviderPort`/`ConnectedMailboxProviderPort` separate for the identical reason).
 * Real adapters exist for Gmail and Microsoft Graph; platform email providers are never reused
 * for inbox access.
 */
export interface ConnectedInboxProviderPort {
  readonly provider: ConnectedMailboxProvider;

  /** Registers a real provider-native change-notification subscription (Gmail: `users.watch`
   * against Cloud Pub/Sub; Graph: a `subscription` resource). */
  registerWatch(accessToken: string, mailboxUserEmail: string): Promise<RegisterWatchResult>;
  renewWatch(accessToken: string, mailboxUserEmail: string, existingProviderWatchId: string | null): Promise<RegisterWatchResult>;
  stopWatch(accessToken: string, providerWatchId: string | null): Promise<void>;

  /** Incremental: given a previously-persisted cursor, returns only what changed since — never a
   * full-mailbox scan (Phase 5: "must not depend solely on aggressive full-mailbox polling"). */
  fetchChangedMessages(accessToken: string, sinceHistoryCursor: string): Promise<FetchChangesResult>;

  fetchMessageMetadata(accessToken: string, providerMessageId: string): Promise<ProviderInboxMessageMetadata>;
  /** Only ever called after the privacy filter and correlation gate have both already passed for
   * this specific message — never called speculatively across an entire changed-message batch. */
  fetchMessageContent(accessToken: string, providerMessageId: string): Promise<ProviderInboxMessageContent>;

  /** A real, current cursor to start from — used the first time a mailbox's inbox reading is
   * activated (no prior cursor exists yet), never for ordinary incremental polling. */
  fetchCurrentHistoryCursor(accessToken: string): Promise<string>;

  checkInboxCapabilityHealth(accessToken: string): Promise<{ readonly healthy: boolean; readonly detail: string }>;
  detectThrottling(httpStatus: number, retryAfterHeader: string | null): ThrottleInfo;
}
