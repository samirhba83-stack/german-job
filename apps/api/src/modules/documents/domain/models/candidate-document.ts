import { DocumentScanStatus, DocumentType } from './document-type';

/**
 * M28.5 — the one authoritative internal attachment reference model (Phase 2). Every field the
 * brief requires: internal id, owner, document type, storage provider/object identifier, both
 * filenames (original vs. the normalized safe name actually used on delivery), MIME type, byte
 * size, checksum, version, timestamps, and authorization scope. Never carries binary content —
 * that only ever exists transiently inside `ResolvedAttachmentPayload`, produced by the
 * `AttachmentResolverPort`, never persisted.
 */
export interface CandidateDocumentRecord {
  readonly id: string;
  readonly ownerUserId: string;
  readonly documentType: DocumentType;
  readonly version: number;
  readonly isActive: boolean;

  readonly storageProvider: string;
  readonly storageBucket: string;
  readonly storageObjectKey: string;

  readonly originalFileName: string;
  readonly safeFileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;

  readonly scanStatus: DocumentScanStatus;
  readonly scanFailureReason: string | null;
  readonly scannedAt: Date | null;

  /** Null = authorized for any of this owner's applications (the normal case for a reusable
   * CV/motivation letter); set = scoped to one specific application submission. */
  readonly scopeApplicationId: string | null;

  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateCandidateDocumentInput {
  readonly ownerUserId: string;
  readonly documentType: DocumentType;
  readonly storageProvider: string;
  readonly storageBucket: string;
  readonly storageObjectKey: string;
  readonly originalFileName: string;
  readonly safeFileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly scopeApplicationId: string | null;
}
