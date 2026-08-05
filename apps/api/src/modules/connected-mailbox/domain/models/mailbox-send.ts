import { ResolvedEmailAttachment } from '../../../email-provider/domain/models/resolved-email-attachment';
import { ProviderFailure } from '../../../email-provider/domain/models/provider-failure';

/** Reuses the exact `ResolvedEmailAttachment`/`ProviderFailure` shapes already established by
 * `email-provider` (M11/M28) — Phase 11's own instruction to "reuse shared lower-level concepts
 * where safe: attachment payload, failure taxonomy" while keeping mailbox OAuth credentials
 * completely isolated from platform-provider credentials (no shared port, no shared adapter, no
 * shared token storage — only these plain, credential-free data shapes are shared). */
export interface MailboxSendRequest {
  readonly requestId: string;
  readonly fromDisplayName: string;
  /** Always the connected mailbox's own verified address — never client-suppliable, never any
   * value other than what `getMailboxIdentity()` returned at connection time. */
  readonly fromEmailAddress: string;
  readonly recipientEmailAddress: string;
  readonly subject: string;
  readonly plainTextBody: string | null;
  readonly htmlBody: string | null;
  readonly resolvedAttachments: ReadonlyArray<ResolvedEmailAttachment>;
}

export type MailboxSendStatus = 'ACCEPTED' | 'DEFERRED' | 'REJECTED' | 'FAILED' | 'UNSUPPORTED';

export interface MailboxSendResponse {
  readonly status: MailboxSendStatus;
  readonly accepted: boolean;
  readonly providerMessageId: string | null;
  readonly providerThreadId: string | null;
  /** M29 Phase 1 finding: no RFC 5322 `Message-ID` was captured anywhere after a send, though
   * `providerThreadId` (Gmail threadId / Graph conversationId) already was — both are needed for
   * `ReplyCorrelationService`'s layered strong signals (thread-id matching AND In-Reply-To/
   * References matching). Gmail: we generate and embed this ourselves in the raw MIME we already
   * build. Outlook: Graph's own `internetMessageId` on the created message *is* the real RFC
   * Message-ID — captured from the draft-creation response, never invented. */
  readonly rfcMessageId: string | null;
  readonly providerMessage: string;
  readonly failure: ProviderFailure | null;
}

/** What `getMailboxIdentity()` returns — the ONLY source of truth for "which real mailbox did the
 * user just authorize," never a value the frontend supplies (Phase 5: "Never trust an email
 * address supplied by the frontend as proof of mailbox ownership"). */
export interface ProviderMailboxIdentity {
  readonly providerAccountId: string;
  readonly emailAddress: string;
  readonly displayName: string | null;
}

export interface ExchangeCodeResult {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly expiresInSeconds: number;
  readonly grantedScopes: ReadonlyArray<string>;
}

export interface RefreshTokenResult {
  readonly accessToken: string;
  readonly expiresInSeconds: number;
  /** Some providers (Microsoft) rotate the refresh token on every refresh — when present, the
   * caller must persist this new value and discard the old one. */
  readonly refreshToken: string | null;
}

export interface MailboxHealthCheckResult {
  readonly healthy: boolean;
  readonly detail: string;
}
