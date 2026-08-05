/**
 * Provider-independent delivery status values. Every future provider (SMTP, Gmail, Microsoft
 * Graph, SES, Mailgun, SendGrid, ...) must map its own provider-specific result onto one of
 * these — nothing outside the provider's own adapter should ever see a provider-specific status
 * string.
 *
 * - ACCEPTED: the provider accepted the message for delivery (standard email semantics — this is
 *   not a guarantee of final inbox delivery, only that the provider took responsibility for it).
 * - DEFERRED: the provider temporarily could not accept the message (e.g. rate limited); retryable.
 * - REJECTED: the provider permanently refused the message (e.g. invalid recipient).
 * - FAILED: a hard failure occurred that isn't a rejection or a capability mismatch.
 * - UNSUPPORTED: the request needs a capability (attachments, HTML, ...) the provider doesn't have.
 */
export type DeliveryStatus = 'ACCEPTED' | 'DEFERRED' | 'REJECTED' | 'FAILED' | 'UNSUPPORTED';
