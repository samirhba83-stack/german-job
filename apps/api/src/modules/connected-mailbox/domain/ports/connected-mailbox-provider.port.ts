import { ConnectedMailboxProvider } from '../models/connected-mailbox';
import {
  ExchangeCodeResult,
  MailboxHealthCheckResult,
  MailboxSendRequest,
  MailboxSendResponse,
  ProviderMailboxIdentity,
  RefreshTokenResult,
} from '../models/mailbox-send';

export const CONNECTED_MAILBOX_PROVIDERS = Symbol('CONNECTED_MAILBOX_PROVIDERS');

export interface AuthorizationUrlParams {
  readonly state: string;
  readonly codeChallenge: string;
  readonly redirectUri: string;
  /** M29 — extra scopes to request beyond this provider's fixed base send-scope set, e.g. the
   * inbox-reading upgrade scopes. Omitted for an ordinary send-only connection (the existing
   * M28.6 behavior, unchanged); `InboxConsentService` passes the real inbox scopes here so the
   * resulting token covers the union (Google's incremental-authorization model; a fresh combined
   * consent request on Microsoft) rather than requesting inbox scopes in isolation. */
  readonly additionalScopes?: ReadonlyArray<string>;
}

/**
 * M28.6 Phase 3 — the one provider-independent OAuth+send abstraction every Gmail/Outlook
 * adapter implements. Deliberately separate from `EmailProviderPort` (M11): that port models a
 * platform-credentialed provider sending on the platform's own behalf; this port models a real
 * user's own OAuth-authorized mailbox — different trust boundary, different credential lifecycle,
 * never unified into one interface (Phase 11: "do not combine these two purposes into one
 * ambiguous provider manager").
 */
export interface ConnectedMailboxProviderPort {
  readonly provider: ConnectedMailboxProvider;

  buildAuthorizationUrl(params: AuthorizationUrlParams): string;

  /** Exchanges a real authorization code for real tokens. Never called with a client-supplied
   * `redirectUri` — always the one fixed, server-configured value for this provider. */
  exchangeAuthorizationCode(code: string, codeVerifier: string, redirectUri: string): Promise<ExchangeCodeResult>;

  refreshAccessToken(refreshToken: string): Promise<RefreshTokenResult>;

  /** Best-effort — not every provider guarantees synchronous revocation confirmation; the caller
   * treats "authorization no longer usable on our side" as the real outcome regardless. */
  revokeAuthorization(refreshToken: string): Promise<void>;

  /** The ONLY source of truth for which real mailbox was just authorized — never trust a
   * frontend-supplied email address as proof of ownership (Phase 5). */
  getMailboxIdentity(accessToken: string): Promise<ProviderMailboxIdentity>;

  sendMessage(accessToken: string, request: MailboxSendRequest): Promise<MailboxSendResponse>;

  checkHealth(accessToken: string): Promise<MailboxHealthCheckResult>;
}
