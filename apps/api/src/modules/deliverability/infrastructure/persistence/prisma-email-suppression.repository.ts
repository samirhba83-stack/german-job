import { Injectable } from '@nestjs/common';
import type { EmailSuppressionEntry as PrismaEmailSuppressionEntry, Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { EmailSuppressionEntryRecord, EmailSuppressionRepository } from '../../domain/ports/email-suppression.repository';
import { EmailSuppressionReason } from '../../domain/models/email-message';

@Injectable()
export class PrismaEmailSuppressionRepository implements EmailSuppressionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isSuppressed(emailAddress: string): Promise<boolean> {
    const row = await this.prisma.emailSuppressionEntry.findUnique({ where: { emailAddress } });
    return row !== null;
  }

  async suppress(emailAddress: string, reason: EmailSuppressionReason, source: string, note: string | null, now: Date): Promise<EmailSuppressionEntryRecord> {
    const row = await this.prisma.emailSuppressionEntry.upsert({
      where: { emailAddress },
      // Already suppressed — leave the original reason/source/timestamp as the real historical
      // record rather than overwriting it with whatever triggered this second call.
      update: {},
      create: {
        emailAddress,
        reason: reason as unknown as Prisma.EmailSuppressionEntryCreateInput['reason'],
        source,
        note,
        createdAt: now,
      },
    });
    return this.toRecord(row);
  }

  async remove(emailAddress: string): Promise<void> {
    await this.prisma.emailSuppressionEntry.deleteMany({ where: { emailAddress } });
  }

  async list(limit: number, offset: number): Promise<EmailSuppressionEntryRecord[]> {
    const rows = await this.prisma.emailSuppressionEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return rows.map((row) => this.toRecord(row));
  }

  async count(): Promise<number> {
    return this.prisma.emailSuppressionEntry.count();
  }

  private toRecord(row: PrismaEmailSuppressionEntry): EmailSuppressionEntryRecord {
    return {
      id: row.id,
      emailAddress: row.emailAddress,
      reason: row.reason as unknown as EmailSuppressionReason,
      source: row.source,
      note: row.note,
      createdAt: row.createdAt,
    };
  }
}
