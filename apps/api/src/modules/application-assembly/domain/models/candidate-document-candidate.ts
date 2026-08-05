/**
 * A candidate document (CV, motivation letter, or certificate) as seen by the assembly engine.
 * Deliberately not the `documents` module's own `CandidateDocumentRecord` — this is the
 * anti-corruption-layer projection the domain-layer strategy operates on, shaped so a future
 * richer document model plugs in without changing strategy code (only the application-layer
 * translation would grow).
 *
 * M28.5: `documentReference` is the real, internal `CandidateDocument.id` — never a raw URL or
 * filesystem path (Non-Negotiable Principle #1). Named deliberately unlike a generic "id" so a
 * future reader immediately understands this is the value that flows, unchanged, into
 * `AssembledAttachment.contentReference` and ultimately `AttachmentReferenceContext.documentId`
 * at the one authoritative resolver.
 */
export interface CandidateDocumentCandidate {
  readonly id: string;
  readonly fileName: string;
  readonly documentReference: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly uploadedAt: Date;
}
