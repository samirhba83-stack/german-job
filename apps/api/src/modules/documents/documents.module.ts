import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutionModule } from '../execution/execution.module';
import { CANDIDATE_DOCUMENT_REPOSITORY } from './domain/ports/candidate-document.repository';
import { STORAGE_PORT } from './domain/ports/storage.port';
import { ATTACHMENT_SCANNER_PORT } from './domain/ports/attachment-scanner.port';
import { ATTACHMENT_RESOLVER_PORT } from './domain/ports/attachment-resolver.port';
import { EMAIL_SECURITY_AUDIT_REPOSITORY } from './domain/ports/email-security-audit.repository';
import { PrismaCandidateDocumentRepository } from './infrastructure/persistence/prisma-candidate-document.repository';
import { PrismaEmailSecurityAuditRepository } from './infrastructure/persistence/prisma-email-security-audit.repository';
import { MinioStorageAdapter } from './infrastructure/adapters/minio-storage.adapter';
import { DeterministicSafeScannerAdapter } from './infrastructure/adapters/deterministic-safe-scanner.adapter';
import { EmailSecurityAuditService } from './application/services/email-security-audit.service';
import { DocumentUploadService } from './application/services/document-upload.service';
import { AttachmentResolverService } from './application/services/attachment-resolver.service';
import { DocumentsController } from './presentation/controllers/documents.controller';

/**
 * M28.5 — Candidate document storage, upload, and secure attachment resolution. A self-contained
 * bounded context: depends only on `ExecutionModule` (for `ExecutionClock`) and framework/auth
 * infrastructure — never on `deliverability`, so the dependency direction stays one-way
 * (`deliverability` -> `documents`, established when `DeliverabilityModule` is wired to import
 * this module for the Provider Manager's attachment resolution step).
 */
@Module({
  imports: [ExecutionModule],
  controllers: [DocumentsController],
  providers: [
    { provide: CANDIDATE_DOCUMENT_REPOSITORY, useClass: PrismaCandidateDocumentRepository },
    { provide: EMAIL_SECURITY_AUDIT_REPOSITORY, useClass: PrismaEmailSecurityAuditRepository },
    MinioStorageAdapter,
    { provide: STORAGE_PORT, useExisting: MinioStorageAdapter },
    { provide: ATTACHMENT_SCANNER_PORT, useClass: DeterministicSafeScannerAdapter },
    EmailSecurityAuditService,
    DocumentUploadService,
    AttachmentResolverService,
    { provide: ATTACHMENT_RESOLVER_PORT, useExisting: AttachmentResolverService },
  ],
  exports: [ATTACHMENT_RESOLVER_PORT, EmailSecurityAuditService, CANDIDATE_DOCUMENT_REPOSITORY, EMAIL_SECURITY_AUDIT_REPOSITORY],
})
export class DocumentsModule implements OnModuleInit {
  constructor(
    private readonly storage: MinioStorageAdapter,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const bucket = this.config.get<string>('attachmentSecurity.storage.bucket', 'candidate-documents');
    await this.storage.ensureBucketExists(bucket);
  }
}
