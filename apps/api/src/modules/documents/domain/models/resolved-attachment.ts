/**
 * The bounded, provider-neutral payload the `AttachmentResolverPort` returns — real bytes, but
 * only ever the bytes of one already-policy-validated, already-scanned, already-checksum-verified
 * document, and only ever up to the policy's own size cap (Phase 3/8: "Return a bounded,
 * provider-neutral attachment payload" / "bounded attachment reads"). Never logged in full —
 * callers must only ever log `fileName`/`mimeType`/`sizeBytes`/`checksumSha256`, never `content`.
 */
export interface ResolvedAttachmentPayload {
  readonly documentId: string;
  readonly version: number;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly content: Buffer;
}

/** What the resolver needs to authorize a request — never just a bare document id. Every field
 * here is required so a caller cannot accidentally resolve "someone's CV" without stating whose
 * request this is and what it's for (Non-Negotiable Principles #2/#3/#4). */
export interface AttachmentReferenceContext {
  readonly documentId: string;
  readonly requestingUserId: string;
  readonly applicationContextId: string | null;
}

export type AttachmentResolutionFailureReason =
  | 'DOCUMENT_NOT_FOUND'
  | 'OWNERSHIP_MISMATCH'
  | 'SCOPE_MISMATCH'
  | 'DOCUMENT_INACTIVE'
  | 'MIME_TYPE_NOT_ALLOWED'
  | 'FILE_TOO_LARGE'
  | 'TOTAL_SIZE_EXCEEDED'
  | 'TOO_MANY_ATTACHMENTS'
  | 'SCAN_REJECTED'
  | 'SCAN_FAILED'
  | 'SCAN_NOT_COMPLETE'
  | 'CHECKSUM_MISMATCH'
  | 'STORAGE_UNAVAILABLE';

export interface AttachmentResolutionFailure {
  readonly reason: AttachmentResolutionFailureReason;
  readonly documentId: string | null;
  readonly detail: string;
}

export interface AttachmentResolutionResult {
  readonly resolved: ReadonlyArray<ResolvedAttachmentPayload>;
  readonly failure: AttachmentResolutionFailure | null;
}
