import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { CandidateDocumentRepository, CANDIDATE_DOCUMENT_REPOSITORY } from '../../domain/ports/candidate-document.repository';
import { StoragePort, STORAGE_PORT } from '../../domain/ports/storage.port';
import { AttachmentScannerPort, ATTACHMENT_SCANNER_PORT } from '../../domain/ports/attachment-scanner.port';
import { CandidateDocumentRecord } from '../../domain/models/candidate-document';
import { DocumentType } from '../../domain/models/document-type';
import { checkAttachmentPolicy, AttachmentPolicyRejectionReason } from '../../domain/services/attachment-policy';
import { EmailSecurityAuditService } from './email-security-audit.service';

export interface UploadDocumentParams {
  readonly ownerUserId: string;
  readonly documentType: DocumentType;
  readonly originalFileName: string;
  readonly claimedMimeType: string;
  readonly content: Buffer;
  readonly scopeApplicationId: string | null;
}

export type UploadDocumentResult =
  | { readonly accepted: true; readonly document: CandidateDocumentRecord }
  | { readonly accepted: false; readonly rejectionReason: AttachmentPolicyRejectionReason; readonly detail: string };

/**
 * M28.5 — the one place a candidate document is ever accepted into this application. Policy
 * rejections (Phase 4) never touch storage or the database at all — only a file that already
 * passes MIME/magic-byte/size/encryption checks is ever written to object storage or given a
 * `CandidateDocument` row. Once accepted, it is immediately, synchronously scanned (Phase 5) —
 * the deterministic test scanner is fast/local, so there is no need for an async scan queue at
 * this milestone's scale; a real future AV integration that needs to be async would change this
 * method's shape, not its contract.
 */
@Injectable()
export class DocumentUploadService {
  constructor(
    @Inject(CANDIDATE_DOCUMENT_REPOSITORY) private readonly documents: CandidateDocumentRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(ATTACHMENT_SCANNER_PORT) private readonly scanner: AttachmentScannerPort,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly audit: EmailSecurityAuditService,
    private readonly config: ConfigService,
  ) {}

  async upload(params: UploadDocumentParams): Promise<UploadDocumentResult> {
    const limits = {
      maxFileSizeBytes: this.config.get<number>('attachmentSecurity.policy.maxFileSizeBytes', 10 * 1024 * 1024),
      maxTotalSizeBytes: this.config.get<number>('attachmentSecurity.policy.maxTotalSizeBytes', 20 * 1024 * 1024),
      maxAttachmentCount: this.config.get<number>('attachmentSecurity.policy.maxAttachmentCount', 5),
    };

    const policyResult = checkAttachmentPolicy(
      { documentType: params.documentType, claimedMimeType: params.claimedMimeType, originalFileName: params.originalFileName, content: params.content },
      limits,
    );

    if (!policyResult.accepted) {
      await this.audit.record({
        eventType: 'ATTACHMENT_REJECTED',
        userId: params.ownerUserId,
        applicationId: params.scopeApplicationId,
        detail: policyResult.detail,
        metadata: { reason: policyResult.rejectionReason ?? 'UNKNOWN', stage: 'UPLOAD_POLICY' },
      });
      return { accepted: false, rejectionReason: policyResult.rejectionReason!, detail: policyResult.detail ?? 'Attachment rejected by policy.' };
    }

    const checksum = createHash('sha256').update(params.content).digest('hex');
    const bucket = this.config.get<string>('attachmentSecurity.storage.bucket', 'candidate-documents');
    const objectKey = `${params.ownerUserId}/${params.documentType.toLowerCase()}/${randomUUID()}-${policyResult.safeFileName}`;

    await this.storage.putObject(bucket, objectKey, params.content, params.claimedMimeType);

    const document = await this.documents.createNewVersion({
      ownerUserId: params.ownerUserId,
      documentType: params.documentType,
      storageProvider: this.storage.providerId,
      storageBucket: bucket,
      storageObjectKey: objectKey,
      originalFileName: params.originalFileName,
      safeFileName: policyResult.safeFileName,
      mimeType: params.claimedMimeType,
      sizeBytes: params.content.length,
      checksumSha256: checksum,
      scopeApplicationId: params.scopeApplicationId,
    });

    await this.audit.record({ eventType: 'ATTACHMENT_SCAN_STARTED', documentId: document.id, userId: params.ownerUserId, applicationId: params.scopeApplicationId });
    const scanResult = await this.scanner.scan(params.content, policyResult.safeFileName, params.claimedMimeType);
    const now = this.clock.now();
    await this.documents.updateScanResult(document.id, scanResult.status, scanResult.failureReason, now);
    await this.audit.record({
      eventType: scanResult.status === 'CLEAN' ? 'ATTACHMENT_SCAN_PASSED' : 'ATTACHMENT_SCAN_FAILED',
      documentId: document.id,
      userId: params.ownerUserId,
      applicationId: params.scopeApplicationId,
      detail: scanResult.failureReason,
    });

    return { accepted: true, document: { ...document, scanStatus: scanResult.status, scanFailureReason: scanResult.failureReason, scannedAt: now } };
  }
}
