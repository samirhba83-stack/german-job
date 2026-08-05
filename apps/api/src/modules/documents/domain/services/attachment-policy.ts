import { DocumentType } from '../models/document-type';

/**
 * M28.5 Phase 4 — centralized, allowlist-first attachment policy. Executables, scripts, and
 * archives are rejected by construction (they simply never appear in any allowed-MIME list below)
 * rather than by an explicit denylist, which would need to anticipate every dangerous type.
 * PDF is preferred for CV/motivation letter; DOCX remains allowed for both, matching the
 * pre-existing product decision already encoded in the profile module's CV-metadata DTO before
 * this milestone. Supporting documents are image-only (JPEG/PNG), per the brief's own explicit
 * scope for the initial release.
 */
export const ALLOWED_MIME_TYPES_BY_DOCUMENT_TYPE: Readonly<Record<DocumentType, readonly string[]>> = {
  CV: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  MOTIVATION_LETTER: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  SUPPORTING_DOCUMENT: ['image/jpeg', 'image/png'],
};

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const SAFE_FILENAME_CHARS = /[^a-zA-Z0-9._-]/g;
const MAX_SAFE_FILENAME_LENGTH = 150;

export type DetectedFileKind = 'pdf' | 'ooxml-zip' | 'legacy-doc' | 'jpeg' | 'png' | 'unknown';

/** Real magic-byte sniffing — never trusts the client-declared MIME type alone (Phase 4: "Do not
 * rely only on filename extension"). `legacy-doc` (the old binary .doc format, OLE2 compound
 * file) is detected but not distinguished further — this codebase accepts it via the same
 * `application/msword` slot the pre-existing profile module already allowed. */
export function detectFileKind(content: Buffer): DetectedFileKind {
  if (content.length >= 4 && content.subarray(0, 4).toString('ascii') === '%PDF') return 'pdf';
  if (content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) return 'jpeg';
  if (content.length >= 8 && content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (content.length >= 4 && content[0] === 0x50 && content[1] === 0x4b && content[2] === 0x03 && content[3] === 0x04) {
    // A generic zip signature — only a genuine OOXML package if it actually contains the
    // required [Content_Types].xml part, checked within the first slice of the archive rather
    // than requiring a full zip-directory parse (Phase 4: reject "polyglot or mismatched
    // MIME/extension files" without pulling in a new zip-parsing dependency for this one check).
    const probe = content.subarray(0, Math.min(content.length, 8192)).toString('latin1');
    return probe.includes('[Content_Types].xml') ? 'ooxml-zip' : 'unknown';
  }
  if (content.length >= 8 && content.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return 'legacy-doc';
  return 'unknown';
}

const KIND_TO_MIME_TYPES: Readonly<Record<Exclude<DetectedFileKind, 'unknown'>, readonly string[]>> = {
  pdf: ['application/pdf'],
  'ooxml-zip': [DOCX_MIME_TYPE],
  'legacy-doc': ['application/msword'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
};

/** A best-effort heuristic, not a full PDF-spec parser: a real, unencrypted PDF's own object
 * graph almost never contains the literal ASCII token `/Encrypt` — genuinely encrypted PDFs
 * always declare an `/Encrypt` dictionary reference in their trailer. False negatives are
 * possible for unusual encoding; this is documented as a heuristic in the M28.5 report, not
 * claimed as certain detection (Phase 4: "Reject... password-protected files unless the product
 * supports them" — the product does not support them). */
export function looksLikeEncryptedPdf(content: Buffer): boolean {
  return content.toString('latin1').includes('/Encrypt');
}

/** Strips path separators and anything outside a conservative safe charset, caps length, and
 * preserves the real extension — the delivery filename a provider/recipient ever sees, never the
 * client-supplied original verbatim (Non-Negotiable Principle #1: never trust a raw path). */
export function normalizeToSafeFileName(originalFileName: string): string {
  const base = originalFileName.split(/[/\\]/).pop() ?? 'document';
  const sanitized = base.replace(SAFE_FILENAME_CHARS, '_');
  const trimmed = sanitized.length > MAX_SAFE_FILENAME_LENGTH ? sanitized.slice(-MAX_SAFE_FILENAME_LENGTH) : sanitized;
  return trimmed.length > 0 ? trimmed : 'document';
}

export type AttachmentPolicyRejectionReason =
  | 'MIME_TYPE_NOT_ALLOWED'
  | 'MAGIC_BYTES_MISMATCH'
  | 'EMPTY_FILE'
  | 'FILE_TOO_LARGE'
  | 'PASSWORD_PROTECTED';

export interface AttachmentPolicyLimits {
  readonly maxFileSizeBytes: number;
  readonly maxTotalSizeBytes: number;
  readonly maxAttachmentCount: number;
}

export interface AttachmentPolicyCheckInput {
  readonly documentType: DocumentType;
  readonly claimedMimeType: string;
  readonly originalFileName: string;
  readonly content: Buffer;
}

export interface AttachmentPolicyCheckResult {
  readonly accepted: boolean;
  readonly rejectionReason: AttachmentPolicyRejectionReason | null;
  readonly detail: string | null;
  readonly safeFileName: string;
}

/** The one centralized policy check every upload passes through — combines allowlist MIME
 * validation, real magic-byte sniffing (never extension/declared-type alone), size, and the
 * PDF-encryption heuristic. Never a raw path or unbounded value used as a decision input; `content`
 * is expected to already be a fully-buffered, size-capped upload by the time this runs (Phase 8's
 * "early rejection before large allocations" happens one layer up, at the HTTP upload boundary,
 * before this function is even called with the full buffer). */
export function checkAttachmentPolicy(input: AttachmentPolicyCheckInput, limits: AttachmentPolicyLimits): AttachmentPolicyCheckResult {
  const safeFileName = normalizeToSafeFileName(input.originalFileName);

  if (input.content.length === 0) {
    return { accepted: false, rejectionReason: 'EMPTY_FILE', detail: 'The uploaded file is empty.', safeFileName };
  }
  if (input.content.length > limits.maxFileSizeBytes) {
    return {
      accepted: false,
      rejectionReason: 'FILE_TOO_LARGE',
      detail: `File is ${input.content.length} bytes, exceeding the ${limits.maxFileSizeBytes}-byte limit.`,
      safeFileName,
    };
  }

  const allowedMimeTypes = ALLOWED_MIME_TYPES_BY_DOCUMENT_TYPE[input.documentType];
  if (!allowedMimeTypes.includes(input.claimedMimeType)) {
    return {
      accepted: false,
      rejectionReason: 'MIME_TYPE_NOT_ALLOWED',
      detail: `MIME type "${input.claimedMimeType}" is not permitted for document type ${input.documentType}.`,
      safeFileName,
    };
  }

  const detectedKind = detectFileKind(input.content);
  const kindMimeTypes = detectedKind === 'unknown' ? [] : KIND_TO_MIME_TYPES[detectedKind];
  if (!kindMimeTypes.includes(input.claimedMimeType)) {
    return {
      accepted: false,
      rejectionReason: 'MAGIC_BYTES_MISMATCH',
      detail: `Declared MIME type "${input.claimedMimeType}" does not match the file's real content (detected: ${detectedKind}).`,
      safeFileName,
    };
  }

  if (detectedKind === 'pdf' && looksLikeEncryptedPdf(input.content)) {
    return { accepted: false, rejectionReason: 'PASSWORD_PROTECTED', detail: 'The PDF appears to be password-protected or encrypted.', safeFileName };
  }

  return { accepted: true, rejectionReason: null, detail: null, safeFileName };
}

export type AttachmentCountRejectionReason = 'TOO_MANY_ATTACHMENTS' | 'TOTAL_SIZE_EXCEEDED';

export function checkAttachmentBudget(
  existingCount: number,
  existingTotalBytes: number,
  newFileBytes: number,
  limits: AttachmentPolicyLimits,
): { readonly accepted: boolean; readonly rejectionReason: AttachmentCountRejectionReason | null; readonly detail: string | null } {
  if (existingCount + 1 > limits.maxAttachmentCount) {
    return { accepted: false, rejectionReason: 'TOO_MANY_ATTACHMENTS', detail: `Adding this attachment would exceed the ${limits.maxAttachmentCount}-attachment limit.` };
  }
  if (existingTotalBytes + newFileBytes > limits.maxTotalSizeBytes) {
    return { accepted: false, rejectionReason: 'TOTAL_SIZE_EXCEEDED', detail: `Adding this attachment would exceed the ${limits.maxTotalSizeBytes}-byte total message size limit.` };
  }
  return { accepted: true, rejectionReason: null, detail: null };
}
