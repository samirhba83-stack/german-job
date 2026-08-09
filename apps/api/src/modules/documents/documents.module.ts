import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
 *
 * M30 fix — this module's own constructor (`onModuleInit`, below) injects `ConfigService`
 * directly, but never imported `ConfigModule` itself: it silently relied on `AppModule`'s
 * `ConfigModule.forRoot({ isGlobal: true })` registration, which only exists when the FULL app
 * module graph is compiled. `CampaignExecutionTaskHandlerModule` (M30) now imports this module,
 * which pulled it — for the first time — into a narrower, hand-assembled partial testing module
 * (`test/execution-resilience.e2e-spec.ts`, pre-existing from M19) that never registers
 * `ConfigModule` at all, causing a real `UnknownDependenciesException` there. Explicitly importing
 * `ConfigModule` here (safe and idempotent even though it's also global — NestJS module resolution
 * treats it as the same singleton either way) makes this module correctly self-contained instead
 * of silently depending on which other module happens to be compiled alongside it.
 */
@Module({
  imports: [ExecutionModule, ConfigModule],
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
