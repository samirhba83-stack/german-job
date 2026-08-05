import { Injectable } from '@nestjs/common';
import type { EmailEvent as PrismaEmailEvent, Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { EmailEventRecord, EmailEventRepository, RecordEmailEventInput } from '../../domain/ports/email-event.repository';
import { EmailEventType } from '../../domain/models/email-message';

@Injectable()
export class PrismaEmailEventRepository implements EmailEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordEmailEventInput, now: Date): Promise<EmailEventRecord> {
    const created = await this.prisma.emailEvent.create({
      data: {
        emailMessageId: input.emailMessageId,
        eventType: input.eventType as unknown as Prisma.EmailEventCreateInput['eventType'],
        providerId: input.providerId,
        detail: input.detail,
        metadata: input.metadata as unknown as Prisma.InputJsonValue,
        occurredAt: now,
      },
    });
    return this.toRecord(created);
  }

  async listForMessage(emailMessageId: string): Promise<EmailEventRecord[]> {
    const rows = await this.prisma.emailEvent.findMany({
      where: { emailMessageId },
      orderBy: { occurredAt: 'asc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: PrismaEmailEvent): EmailEventRecord {
    return {
      id: row.id,
      emailMessageId: row.emailMessageId,
      eventType: row.eventType as unknown as EmailEventType,
      providerId: row.providerId,
      detail: row.detail,
      metadata: (row.metadata as unknown as Record<string, string>) ?? {},
      occurredAt: row.occurredAt,
    };
  }
}
