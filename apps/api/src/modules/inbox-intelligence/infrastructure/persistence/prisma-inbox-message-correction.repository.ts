import { Injectable } from '@nestjs/common';
import type { InboxMessageCorrection as PrismaCorrection, Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { InboxMessageCorrectionRepository } from '../../domain/ports/inbox-message-correction.repository';
import { InboxMessageCorrectionRecord, CreateInboxMessageCorrectionInput, InboxMessageCorrectionType } from '../../domain/models/inbox-message-correction';

@Injectable()
export class PrismaInboxMessageCorrectionRepository implements InboxMessageCorrectionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateInboxMessageCorrectionInput, now: Date): Promise<InboxMessageCorrectionRecord> {
    const row = await this.prisma.inboxMessageCorrection.create({
      data: {
        inboxMessageId: input.inboxMessageId,
        correctionType: input.correctionType as unknown as Prisma.InboxMessageCorrectionCreateInput['correctionType'],
        originalValue: input.originalValue as unknown as Prisma.InputJsonValue,
        correctedValue: input.correctedValue as unknown as Prisma.InputJsonValue,
        correctedByUserId: input.correctedByUserId,
        reason: input.reason,
        createdAt: now,
      },
    });
    return this.toRecord(row);
  }

  async listByInboxMessageId(inboxMessageId: string): Promise<InboxMessageCorrectionRecord[]> {
    const rows = await this.prisma.inboxMessageCorrection.findMany({ where: { inboxMessageId }, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: PrismaCorrection): InboxMessageCorrectionRecord {
    return {
      id: row.id,
      inboxMessageId: row.inboxMessageId,
      correctionType: row.correctionType as unknown as InboxMessageCorrectionType,
      originalValue: row.originalValue as unknown as Record<string, unknown>,
      correctedValue: row.correctedValue as unknown as Record<string, unknown>,
      correctedByUserId: row.correctedByUserId,
      reason: row.reason,
      createdAt: row.createdAt,
    };
  }
}
