import { ResolvedEmailAttachment } from '../models/resolved-email-attachment';

/** Base64 encoding inflates binary content by ~33% (4 output bytes per 3 input bytes, rounded up
 * to the next 4-byte group) — a real, well-known encoding overhead every REST-JSON or raw-MIME
 * provider transport pays. `checkAttachmentPolicy` (documents module) bounds the RAW file size at
 * upload time, but a provider's own documented limit (e.g. SES's 10MB raw *message* size) applies
 * to the post-encoding wire size — Phase 8 "safe base64 size calculations" exists precisely
 * because these two numbers are not the same. */
export function estimateBase64InflatedSize(rawBytes: number): number {
  return Math.ceil(rawBytes / 3) * 4;
}

/** Returns a human-readable reason when the resolved attachments, once base64-encoded, would
 * exceed this specific provider's own documented size limit — `null` when within bounds (or when
 * the provider reports no known limit). Checked once per `send()` call, before any network
 * request is made, so an oversized-for-this-provider request never gets a confusing rejection
 * from the wire — the Provider Manager's failover then has a real chance to try a provider with a
 * larger limit instead. */
export function checkAttachmentSizeAgainstCapability(attachments: ReadonlyArray<ResolvedEmailAttachment>, maxAttachmentSizeBytes: number | null): string | null {
  if (maxAttachmentSizeBytes === null || attachments.length === 0) {
    return null;
  }
  const totalRawBytes = attachments.reduce((sum, attachment) => sum + attachment.content.length, 0);
  const estimatedWireBytes = estimateBase64InflatedSize(totalRawBytes);
  if (estimatedWireBytes > maxAttachmentSizeBytes) {
    return `Attachments total ${totalRawBytes} raw bytes (~${estimatedWireBytes} bytes after base64 encoding), exceeding this provider's ${maxAttachmentSizeBytes}-byte limit.`;
  }
  return null;
}
