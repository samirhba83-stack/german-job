import { ConnectedMailboxProvider } from '../models/connected-mailbox';

/**
 * M28.6 Phase 4 — least privilege. The smallest provider-supported scope set required to send
 * email and verify mailbox identity — nothing else. No contacts, calendar, drive, or full mailbox
 * read access. Future Inbox Intelligence scopes are an explicit, separate, later consent upgrade
 * (Phase 4/15), never bundled in here.
 *
 * Gmail: `gmail.send` (send-only — cannot read, search, or modify existing mail), `userinfo.email`
 * (the verified address + `sub`, the real provider account id), `openid` (required by Google's
 * OAuth implementation to receive `userinfo.email` via the standard flow). Deliberately excludes
 * `userinfo.profile` — a display name is a nice-to-have, not required to send or verify identity.
 *
 * Microsoft Graph: `Mail.Send` (send-only), `User.Read` (minimal profile read — required to call
 * `/me` and verify the real mailbox address/id), `offline_access` (without this, Microsoft's
 * identity platform issues no refresh token at all — required for this to function as anything
 * other than a one-hour, non-renewable connection), `openid`.
 */
export const GOOGLE_GMAIL_REQUIRED_SCOPES: ReadonlyArray<string> = ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email', 'openid'];

export const MICROSOFT_OUTLOOK_REQUIRED_SCOPES: ReadonlyArray<string> = ['Mail.Send', 'User.Read', 'offline_access', 'openid'];

/**
 * M29 Phase 3 — the inbox-reading upgrade scopes, requested ONLY when a user explicitly upgrades
 * to `READ_APPLICATION_REPLIES` consent (never bundled into the initial send-only connection).
 *
 * Researched against the real, current Gmail/Graph scope catalogues: neither provider offers a
 * scope narrower than "read the whole mailbox's messages" that still permits reading message
 * BODY content (Gmail's `gmail.metadata`/Graph's `Mail.ReadBasic` both exist specifically as
 * headers-only, no-body alternatives — insufficient for Phase 3's own requirement to "read the
 * content of matched recruitment replies"). This is the real, documented trade-off Phase 3 itself
 * anticipates ("where a provider cannot offer a sufficiently narrow scope, document the trade-off
 * clearly and implement strict application-level filtering") — compensated for by
 * `ReplyCorrelationService`/`PrivacyFilterService` (Phases 6/7), which ensure this broader
 * OAuth-level grant is never exercised beyond messages that actually correlate to a real,
 * previously-sent application.
 *
 * Gmail: `gmail.readonly` (the one scope permitting body-content reads; deliberately never
 * `gmail.modify` — no label/archive/delete capability requested this milestone, matching Phase 2's
 * own "MANAGE_APPLICATION_LABELS, only if later approved"). Microsoft Graph: `Mail.Read`, the
 * direct equivalent.
 */
export const GOOGLE_GMAIL_INBOX_REQUIRED_SCOPES: ReadonlyArray<string> = ['https://www.googleapis.com/auth/gmail.readonly'];

export const MICROSOFT_OUTLOOK_INBOX_REQUIRED_SCOPES: ReadonlyArray<string> = ['Mail.Read'];

const ALLOWED_SCOPES_BY_PROVIDER: Readonly<Record<ConnectedMailboxProvider, ReadonlySet<string>>> = {
  GOOGLE_GMAIL: new Set(GOOGLE_GMAIL_REQUIRED_SCOPES),
  MICROSOFT_OUTLOOK: new Set(MICROSOFT_OUTLOOK_REQUIRED_SCOPES),
};

const REQUIRED_SCOPES_BY_PROVIDER: Readonly<Record<ConnectedMailboxProvider, ReadonlyArray<string>>> = {
  GOOGLE_GMAIL: GOOGLE_GMAIL_REQUIRED_SCOPES,
  MICROSOFT_OUTLOOK: MICROSOFT_OUTLOOK_REQUIRED_SCOPES,
};

/** M29 — the full UNION allowlist (send + inbox) a mailbox's granted scopes must fall within
 * once it has upgraded to inbox reading. Google's incremental-authorization model (and a fresh
 * consent request on Microsoft) means the resulting token covers BOTH capabilities together, so
 * validation after an inbox upgrade checks against this combined set, never the inbox scopes
 * alone (which would incorrectly flag the still-present send scope as "unexpected"). */
const INBOX_UPGRADE_REQUIRED_SCOPES_BY_PROVIDER: Readonly<Record<ConnectedMailboxProvider, ReadonlyArray<string>>> = {
  GOOGLE_GMAIL: [...GOOGLE_GMAIL_REQUIRED_SCOPES, ...GOOGLE_GMAIL_INBOX_REQUIRED_SCOPES],
  MICROSOFT_OUTLOOK: [...MICROSOFT_OUTLOOK_REQUIRED_SCOPES, ...MICROSOFT_OUTLOOK_INBOX_REQUIRED_SCOPES],
};

const INBOX_UPGRADE_ALLOWED_SCOPES_BY_PROVIDER: Readonly<Record<ConnectedMailboxProvider, ReadonlySet<string>>> = {
  GOOGLE_GMAIL: new Set(INBOX_UPGRADE_REQUIRED_SCOPES_BY_PROVIDER.GOOGLE_GMAIL),
  MICROSOFT_OUTLOOK: new Set(INBOX_UPGRADE_REQUIRED_SCOPES_BY_PROVIDER.MICROSOFT_OUTLOOK),
};

export function requiredScopesFor(provider: ConnectedMailboxProvider): ReadonlyArray<string> {
  return REQUIRED_SCOPES_BY_PROVIDER[provider];
}

/** The scopes to actually REQUEST for an inbox-upgrade authorization request — the full union,
 * never the inbox scopes in isolation, so sending keeps working under the same, single token. */
export function inboxUpgradeScopesToRequestFor(provider: ConnectedMailboxProvider): ReadonlyArray<string> {
  return INBOX_UPGRADE_REQUIRED_SCOPES_BY_PROVIDER[provider];
}

export interface ScopeValidationResult {
  readonly accepted: boolean;
  readonly missingRequiredScopes: ReadonlyArray<string>;
  readonly unexpectedScopes: ReadonlyArray<string>;
}

/** Fails closed on ANY unexpected scope — Phase 4: "If the provider grants broader scopes
 * unexpectedly, do not silently accept them without documented policy." The documented policy
 * here is: reject the connection outright rather than proceed with excess, unrequested
 * permissions, even if the extra scope sounds harmless. */
export function validateGrantedScopes(provider: ConnectedMailboxProvider, grantedScopes: ReadonlyArray<string>): ScopeValidationResult {
  const allowlist = ALLOWED_SCOPES_BY_PROVIDER[provider];
  const required = REQUIRED_SCOPES_BY_PROVIDER[provider];
  const grantedSet = new Set(grantedScopes);

  const missingRequiredScopes = required.filter((scope) => !grantedSet.has(scope));
  const unexpectedScopes = grantedScopes.filter((scope) => !allowlist.has(scope));

  return { accepted: missingRequiredScopes.length === 0 && unexpectedScopes.length === 0, missingRequiredScopes, unexpectedScopes };
}

/** M29 — validates a completed inbox-upgrade grant against the full send+inbox union allowlist.
 * Fails closed identically to `validateGrantedScopes()`: missing ANY required scope (send or
 * inbox) or any unexpected scope beyond the union rejects the whole upgrade — Phase 3's own
 * "unexpected broader scopes fail closed or require explicit documented approval," applied here
 * as fail-closed (no undocumented-approval path exists in this milestone). */
export function validateGrantedInboxScopes(provider: ConnectedMailboxProvider, grantedScopes: ReadonlyArray<string>): ScopeValidationResult {
  const allowlist = INBOX_UPGRADE_ALLOWED_SCOPES_BY_PROVIDER[provider];
  const required = INBOX_UPGRADE_REQUIRED_SCOPES_BY_PROVIDER[provider];
  const grantedSet = new Set(grantedScopes);

  const missingRequiredScopes = required.filter((scope) => !grantedSet.has(scope));
  const unexpectedScopes = grantedScopes.filter((scope) => !allowlist.has(scope));

  return { accepted: missingRequiredScopes.length === 0 && unexpectedScopes.length === 0, missingRequiredScopes, unexpectedScopes };
}
