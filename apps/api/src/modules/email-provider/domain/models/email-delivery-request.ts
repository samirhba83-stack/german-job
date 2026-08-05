import { SenderIdentity } from './sender-identity';
import { EmailAttachmentSpec } from './email-attachment';
import { ResolvedEmailAttachment } from './resolved-email-attachment';

/**
 * A provider-independent request to deliver one email. Every future provider adapter consumes
 * exactly this shape — nothing about it assumes SMTP, a REST API, or any other transport.
 * `requestId` is caller-supplied (not generated here) so the same request can be traced end to
 * end regardless of which provider eventually handles it.
 *
 * M28.5 additions: `requestingUserId`/`applicationContextId` give `EmailProviderManagerService`
 * the authorization context `AttachmentResolverPort` requires — null for callers with no real
 * attachments (e.g. Billing's notifications), never fabricated. `resolvedAttachments` is filled
 * in by `EmailProviderManagerService` itself immediately before each provider attempt, exactly
 * once per send (never per-provider-attempt, satisfying "no duplicate loading of the same
 * attachment") — a provider adapter must never attempt to resolve `attachments[].contentReference`
 * itself; if `attachments` is non-empty and `resolvedAttachments` is absent, every adapter refuses
 * to send rather than silently omitting the attachment (Non-Negotiable Principle #5).
 */
export interface EmailDeliveryRequest {
  readonly requestId: string;
  readonly sender: SenderIdentity;
  readonly recipientEmailAddress: string;
  readonly subject: string;
  readonly plainTextBody: string | null;
  readonly htmlBody: string | null;
  readonly attachments: ReadonlyArray<EmailAttachmentSpec>;
  readonly requestingUserId?: string | null;
  readonly applicationContextId?: string | null;
  readonly resolvedAttachments?: ReadonlyArray<ResolvedEmailAttachment>;
}
