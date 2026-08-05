import { ConnectedMailboxProvider } from '../enums/connected-mailbox-provider.enum';
import { ConnectedMailboxStatus } from '../enums/connected-mailbox-status.enum';
import { InboxCapabilityStatus } from '../enums/inbox-intelligence.enum';

/** M28.6 — the user-facing connected-mailbox view (`GET /mailbox-connections/me`). Never carries
 * token fields, storage internals, or anything beyond what a user needs to see their own
 * connection status (Phase 17). M29 additive: the `inbox*` fields are the SEPARATE inbox-reading
 * consent lifecycle — independent of `status`/`isActive`, which only ever describe send capability. */
export interface ConnectedMailboxDto {
  id: string;
  provider: ConnectedMailboxProvider;
  emailAddress: string;
  displayName: string | null;
  isActive: boolean;
  status: ConnectedMailboxStatus;
  reauthorizationRequired: boolean;
  userDisabled: boolean;
  systemSuspended: boolean;
  suspensionReason: string | null;
  connectedAt: string | null;
  lastRefreshedAt: string | null;
  lastSuccessfulSendAt: string | null;
  lastFailureAt: string | null;
  failureReason: string | null;
  dailySendCount: number;
  createdAt: string;
  inboxCapabilityStatus: InboxCapabilityStatus;
  inboxConsentAcceptedAt: string | null;
  inboxRevokedAt: string | null;
  lastSuccessfulInboxAccessAt: string | null;
  inboxReauthorizationRequired: boolean;
  inboxFailureReason: string | null;
}

/** `POST /mailbox-connections/:provider/start` — the frontend navigates the browser to
 * `authorizationUrl` (the real provider consent screen), same pattern as billing checkout's
 * `checkoutUrl`. */
export interface StartMailboxConnectionResponseDto {
  authorizationUrl: string;
}

/** Admin Operations' view (`GET /admin/connected-mailboxes`) — the same safe fields plus what an
 * admin legitimately needs to investigate and act on a mailbox (Phase 19), still never a token. */
export interface AdminConnectedMailboxDto {
  id: string;
  userId: string;
  provider: ConnectedMailboxProvider;
  emailAddress: string;
  displayName: string | null;
  isActive: boolean;
  status: ConnectedMailboxStatus;
  grantedScopes: string[];
  reauthorizationRequired: boolean;
  userDisabled: boolean;
  systemSuspended: boolean;
  suspensionReason: string | null;
  failureCategory: string | null;
  failureReason: string | null;
  connectedAt: string | null;
  lastRefreshedAt: string | null;
  lastSuccessfulSendAt: string | null;
  lastFailureAt: string | null;
  dailySendCount: number;
  rollingSendCount: number;
  providerDailyLimit: number | null;
  consentVersion: string | null;
  consentAcceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MailboxAdminActionRequestDto {
  reason: string;
}
