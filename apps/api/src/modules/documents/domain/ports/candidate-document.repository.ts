import { CandidateDocumentRecord, CreateCandidateDocumentInput } from '../models/candidate-document';
import { DocumentScanStatus, DocumentType } from '../models/document-type';

export const CANDIDATE_DOCUMENT_REPOSITORY = Symbol('CANDIDATE_DOCUMENT_REPOSITORY');

export interface CandidateDocumentRepository {
  findById(id: string): Promise<CandidateDocumentRecord | null>;

  /** The one active (latest-approved) document of a given type for a given owner, or `null`.
   * "Active" means the version an application should actually use — a superseded version stays
   * in storage/DB for audit/version-history purposes but is never itself selectable again. */
  findActiveByOwnerAndType(ownerUserId: string, documentType: DocumentType): Promise<CandidateDocumentRecord | null>;

  /** Every document explicitly scoped to one specific application — never a general reusable
   * document, matching Non-Negotiable Principle #4 ("never send a document that was not
   * explicitly selected and authorized for that application"). */
  findScopedToApplication(applicationId: string): Promise<CandidateDocumentRecord[]>;

  listByOwner(ownerUserId: string, limit: number, offset: number): Promise<CandidateDocumentRecord[]>;

  /** Creates a new document row and, in the same atomic step, deactivates any prior active
   * document of the same (ownerUserId, documentType) — a re-upload never overwrites a row in
   * place; it creates a new version and retires the old one (Phase 2 mutability requirement). */
  createNewVersion(input: CreateCandidateDocumentInput): Promise<CandidateDocumentRecord>;

  updateScanResult(id: string, scanStatus: DocumentScanStatus, scanFailureReason: string | null, scannedAt: Date): Promise<void>;
}
