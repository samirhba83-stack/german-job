import { Injectable } from '@nestjs/common';
import type { CandidateDocument as PrismaCandidateDocument, Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { CandidateDocumentRepository } from '../../domain/ports/candidate-document.repository';
import { CandidateDocumentRecord, CreateCandidateDocumentInput } from '../../domain/models/candidate-document';
import { DocumentScanStatus, DocumentType } from '../../domain/models/document-type';

@Injectable()
export class PrismaCandidateDocumentRepository implements CandidateDocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<CandidateDocumentRecord | null> {
    const row = await this.prisma.candidateDocument.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async findActiveByOwnerAndType(ownerUserId: string, documentType: DocumentType): Promise<CandidateDocumentRecord | null> {
    const row = await this.prisma.candidateDocument.findFirst({
      where: { ownerUserId, documentType: documentType as unknown as Prisma.CandidateDocumentWhereInput['documentType'], isActive: true },
      orderBy: { version: 'desc' },
    });
    return row ? this.toRecord(row) : null;
  }

  async findScopedToApplication(applicationId: string): Promise<CandidateDocumentRecord[]> {
    const rows = await this.prisma.candidateDocument.findMany({
      where: { scopeApplicationId: applicationId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async listByOwner(ownerUserId: string, limit: number, offset: number): Promise<CandidateDocumentRecord[]> {
    const rows = await this.prisma.candidateDocument.findMany({
      where: { ownerUserId },
      orderBy: [{ documentType: 'asc' }, { version: 'desc' }],
      take: limit,
      skip: offset,
    });
    return rows.map((row) => this.toRecord(row));
  }

  /** Atomic within one transaction: deactivate any prior active document of the same
   * (ownerUserId, documentType), then insert the new version — never a window where two rows
   * are simultaneously active for the same slot, and never an in-place overwrite that would
   * destroy the prior version's own row (Phase 2 mutability requirement). */
  async createNewVersion(input: CreateCandidateDocumentInput): Promise<CandidateDocumentRecord> {
    const created = await this.prisma.$transaction(async (tx) => {
      const priorActive = await tx.candidateDocument.findFirst({
        where: { ownerUserId: input.ownerUserId, documentType: input.documentType as unknown as Prisma.CandidateDocumentWhereInput['documentType'], isActive: true },
        orderBy: { version: 'desc' },
      });

      if (priorActive) {
        await tx.candidateDocument.update({ where: { id: priorActive.id }, data: { isActive: false } });
      }

      return tx.candidateDocument.create({
        data: {
          ownerUserId: input.ownerUserId,
          documentType: input.documentType as unknown as Prisma.CandidateDocumentCreateInput['documentType'],
          version: (priorActive?.version ?? 0) + 1,
          isActive: true,
          storageProvider: input.storageProvider,
          storageBucket: input.storageBucket,
          storageObjectKey: input.storageObjectKey,
          originalFileName: input.originalFileName,
          safeFileName: input.safeFileName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          checksumSha256: input.checksumSha256,
          scopeApplicationId: input.scopeApplicationId,
        },
      });
    });

    return this.toRecord(created);
  }

  async updateScanResult(id: string, scanStatus: DocumentScanStatus, scanFailureReason: string | null, scannedAt: Date): Promise<void> {
    await this.prisma.candidateDocument.update({
      where: { id },
      data: { scanStatus: scanStatus as unknown as Prisma.CandidateDocumentUpdateInput['scanStatus'], scanFailureReason, scannedAt },
    });
  }

  private toRecord(row: PrismaCandidateDocument): CandidateDocumentRecord {
    return {
      id: row.id,
      ownerUserId: row.ownerUserId,
      documentType: row.documentType as unknown as DocumentType,
      version: row.version,
      isActive: row.isActive,
      storageProvider: row.storageProvider,
      storageBucket: row.storageBucket,
      storageObjectKey: row.storageObjectKey,
      originalFileName: row.originalFileName,
      safeFileName: row.safeFileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      checksumSha256: row.checksumSha256,
      scanStatus: row.scanStatus as unknown as DocumentScanStatus,
      scanFailureReason: row.scanFailureReason,
      scannedAt: row.scannedAt,
      scopeApplicationId: row.scopeApplicationId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
