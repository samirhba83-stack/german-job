import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttachmentResolverPort } from '../../domain/ports/attachment-resolver.port';
import { CandidateDocumentRepository, CANDIDATE_DOCUMENT_REPOSITORY } from '../../domain/ports/candidate-document.repository';
import { StoragePort, STORAGE_PORT, StorageObjectNotFoundError, StorageObjectTooLargeError } from '../../domain/ports/storage.port';
import {
  AttachmentReferenceContext,
  AttachmentResolutionFailure,
  AttachmentResolutionResult,
  ResolvedAttachmentPayload,
} from '../../domain/models/resolved-attachment';
import { checkAttachmentBudget } from '../../domain/services/attachment-policy';
import { CandidateDocumentRecord } from '../../domain/models/candidate-document';
import { EmailSecurityAuditService } from './email-security-audit.service';

/**
 * M28.5 Phase 3 — the ONE authoritative `AttachmentResolverPort` implementation. No controller,
 * worker, or provider adapter is permitted to read `StoragePort`/`CandidateDocumentRepository`
 * directly — every real attachment byte this application ever sends flows through `resolve()`.
 *
 * Fails closed as a batch: if ANY reference in the call fails any check, the entire result is a
 * failure and NO bytes are returned for ANY reference — matching Non-Negotiable Principles #5/#6
 * ("never silently omit a required attachment", "never silently replace a missing attachment
 * with another file"). A caller that wants partial delivery must call `resolve()` once per
 * attachment it's willing to have independently fail; this service never makes that call itself.
 */
@Injectable()
export class AttachmentResolverService implements AttachmentResolverPort {
  private readonly logger = new Logger(AttachmentResolverService.name);

  constructor(
    @Inject(CANDIDATE_DOCUMENT_REPOSITORY) private readonly documents: CandidateDocumentRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly audit: EmailSecurityAuditService,
    private readonly config: ConfigService,
  ) {}

  async resolve(references: ReadonlyArray<AttachmentReferenceContext>): Promise<AttachmentResolutionResult> {
    if (references.length === 0) {
      return { resolved: [], failure: null };
    }

    const maxFileSizeBytes = this.config.get<number>('attachmentSecurity.policy.maxFileSizeBytes', 10 * 1024 * 1024);
    const maxTotalSizeBytes = this.config.get<number>('attachmentSecurity.policy.maxTotalSizeBytes', 20 * 1024 * 1024);
    const maxAttachmentCount = this.config.get<number>('attachmentSecurity.policy.maxAttachmentCount', 5);

    const documents: CandidateDocumentRecord[] = [];

    for (const ref of references) {
      await this.audit.record({ eventType: 'ATTACHMENT_REFERENCE_SELECTED', documentId: ref.documentId, userId: ref.requestingUserId, applicationId: ref.applicationContextId });

      const document = await this.documents.findById(ref.documentId);
      const failure = document ? this.checkAuthorization(document, ref) : this.notFoundFailure(ref);

      if (failure) {
        await this.reject(ref, failure);
        return { resolved: [], failure };
      }
      documents.push(document!);
    }

    const budgetFailure = this.checkBudget(references, documents, { maxFileSizeBytes, maxTotalSizeBytes, maxAttachmentCount });
    if (budgetFailure) {
      await this.reject(references[0], budgetFailure);
      return { resolved: [], failure: budgetFailure };
    }

    const resolved: ResolvedAttachmentPayload[] = [];
    for (let i = 0; i < references.length; i++) {
      const ref = references[i];
      const document = documents[i];
      await this.audit.record({ eventType: 'ATTACHMENT_RESOLUTION_STARTED', documentId: document.id, userId: ref.requestingUserId, applicationId: ref.applicationContextId });

      const scanFailure = this.checkScanStatus(document);
      if (scanFailure) {
        await this.reject(ref, scanFailure);
        return { resolved: [], failure: scanFailure };
      }

      let content: Buffer;
      try {
        content = await this.storage.getObject(document.storageBucket, document.storageObjectKey, maxFileSizeBytes);
      } catch (error) {
        const failure = this.storageErrorToFailure(error, document.id);
        await this.reject(ref, failure);
        return { resolved: [], failure };
      }

      const actualChecksum = createHash('sha256').update(content).digest('hex');
      if (actualChecksum !== document.checksumSha256) {
        const failure: AttachmentResolutionFailure = {
          reason: 'CHECKSUM_MISMATCH',
          documentId: document.id,
          detail: `Stored content for document "${document.id}" does not match its recorded checksum — refusing to send, possible corruption or tampering.`,
        };
        this.logger.error(failure.detail);
        await this.reject(ref, failure);
        return { resolved: [], failure };
      }

      await this.audit.record({
        eventType: 'ATTACHMENT_RESOLVED',
        documentId: document.id,
        userId: ref.requestingUserId,
        applicationId: ref.applicationContextId,
        metadata: { fileName: document.safeFileName, mimeType: document.mimeType, sizeBytes: String(document.sizeBytes) },
      });

      resolved.push({
        documentId: document.id,
        version: document.version,
        fileName: document.safeFileName,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        checksumSha256: document.checksumSha256,
        content,
      });
    }

    return { resolved, failure: null };
  }

  private checkAuthorization(document: CandidateDocumentRecord, ref: AttachmentReferenceContext): AttachmentResolutionFailure | null {
    if (document.ownerUserId !== ref.requestingUserId) {
      return { reason: 'OWNERSHIP_MISMATCH', documentId: document.id, detail: `Document "${document.id}" is not owned by the requesting user.` };
    }
    if (document.scopeApplicationId !== null && document.scopeApplicationId !== ref.applicationContextId) {
      return { reason: 'SCOPE_MISMATCH', documentId: document.id, detail: `Document "${document.id}" is scoped to a different application than the one requested.` };
    }
    if (!document.isActive) {
      return { reason: 'DOCUMENT_INACTIVE', documentId: document.id, detail: `Document "${document.id}" is a superseded version and can no longer be selected for delivery.` };
    }
    return null;
  }

  private checkScanStatus(document: CandidateDocumentRecord): AttachmentResolutionFailure | null {
    if (document.scanStatus === 'REJECTED') {
      return { reason: 'SCAN_REJECTED', documentId: document.id, detail: document.scanFailureReason ?? 'Document failed security scanning.' };
    }
    if (document.scanStatus === 'SCAN_FAILED') {
      return { reason: 'SCAN_FAILED', documentId: document.id, detail: document.scanFailureReason ?? 'Document security scan could not complete.' };
    }
    if (document.scanStatus === 'NOT_SCANNED') {
      return { reason: 'SCAN_NOT_COMPLETE', documentId: document.id, detail: `Document "${document.id}" has not completed security scanning yet — refusing to send an unscanned file.` };
    }
    return null;
  }

  private checkBudget(
    refs: ReadonlyArray<AttachmentReferenceContext>,
    documents: ReadonlyArray<CandidateDocumentRecord>,
    limits: { maxFileSizeBytes: number; maxTotalSizeBytes: number; maxAttachmentCount: number },
  ): AttachmentResolutionFailure | null {
    if (documents.length > limits.maxAttachmentCount) {
      return { reason: 'TOO_MANY_ATTACHMENTS', documentId: null, detail: `${documents.length} attachments requested, exceeding the ${limits.maxAttachmentCount}-attachment limit.` };
    }
    const totalBytes = documents.reduce((sum, d) => sum + d.sizeBytes, 0);
    const budget = checkAttachmentBudget(0, 0, totalBytes, limits);
    if (!budget.accepted) {
      return { reason: budget.rejectionReason === 'TOO_MANY_ATTACHMENTS' ? 'TOO_MANY_ATTACHMENTS' : 'TOTAL_SIZE_EXCEEDED', documentId: null, detail: budget.detail ?? 'Attachment budget exceeded.' };
    }
    for (const document of documents) {
      if (document.sizeBytes > limits.maxFileSizeBytes) {
        return { reason: 'FILE_TOO_LARGE', documentId: document.id, detail: `Document "${document.id}" is ${document.sizeBytes} bytes, exceeding the current ${limits.maxFileSizeBytes}-byte limit.` };
      }
    }
    return null;
  }

  private notFoundFailure(ref: AttachmentReferenceContext): AttachmentResolutionFailure {
    return { reason: 'DOCUMENT_NOT_FOUND', documentId: ref.documentId, detail: `No document exists with id "${ref.documentId}".` };
  }

  private storageErrorToFailure(error: unknown, documentId: string): AttachmentResolutionFailure {
    if (error instanceof StorageObjectNotFoundError) {
      return { reason: 'STORAGE_UNAVAILABLE', documentId, detail: `Stored object for document "${documentId}" is missing from storage.` };
    }
    if (error instanceof StorageObjectTooLargeError) {
      return { reason: 'FILE_TOO_LARGE', documentId, detail: error.message };
    }
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`Storage read failed for document "${documentId}": ${message}`);
    return { reason: 'STORAGE_UNAVAILABLE', documentId, detail: `Storage is temporarily unavailable for document "${documentId}".` };
  }

  private async reject(ref: AttachmentReferenceContext, failure: AttachmentResolutionFailure): Promise<void> {
    await this.audit.record({
      eventType: 'ATTACHMENT_REJECTED',
      documentId: failure.documentId ?? ref.documentId,
      userId: ref.requestingUserId,
      applicationId: ref.applicationContextId,
      detail: failure.detail,
      metadata: { reason: failure.reason },
    });
  }
}
