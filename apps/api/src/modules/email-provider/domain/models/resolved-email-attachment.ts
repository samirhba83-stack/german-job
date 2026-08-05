/**
 * M28.5 — the real, bounded bytes of one already-resolved, already-security-checked attachment,
 * ready to hand to a provider adapter's `send()`. Deliberately a distinct, provider-facing shape
 * from `documents`' own `ResolvedAttachmentPayload` (which additionally carries `documentId`/
 * `checksumSha256` — internal bookkeeping a provider adapter has no business seeing), matching
 * this codebase's established anti-corruption-layer precedent between bounded contexts (e.g.
 * `AssembledAttachment` vs. `EmailAttachmentSpec`). Never persisted — exists only transiently for
 * the duration of one send attempt.
 */
export interface ResolvedEmailAttachment {
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly content: Buffer;
}
