import { Injectable } from '@nestjs/common';
import type { EmailSecurityAuditEvent as PrismaEmailSecurityAuditEvent, Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  EmailSecurityAuditRepository,
  RecordEmailSecurityAuditEventInput,
  EmailSecurityAuditEventRecord,
  EmailSecurityAuditEventFilter,
} from '../../domain/ports/email-security-audit.repository';
import { EmailSecurityAuditEventType } from '../../domain/models/email-security-audit-event';

@Injectable()
export class PrismaEmailSecurityAuditRepository implements EmailSecurityAuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordEmailSecurityAuditEventInput, now: Date): Promise<void> {
    await this.prisma.emailSecurityAuditEvent.create({
      data: {
        eventType: input.eventType as unknown as Prisma.EmailSecurityAuditEventCreateInput['eventType'],
        documentId: input.documentId ?? null,
        emailMessageId: input.emailMessageId ?? null,
        senderIdentityId: input.senderIdentityId ?? null,
        connectedMailboxId: input.connectedMailboxId ?? null,
        inboxMessageId: input.inboxMessageId ?? null,
        userId: input.userId ?? null,
        applicationId: input.applicationId ?? null,
        campaignId: input.campaignId ?? null,
        detail: input.detail ?? null,
        metadata: (input.metadata ?? {}) as unknown as Prisma.InputJsonValue,
        occurredAt: now,
      },
    });
  }

  async list(filter: EmailSecurityAuditEventFilter, limit: number, offset: number): Promise<EmailSecurityAuditEventRecord[]> {
    const rows = await this.prisma.emailSecurityAuditEvent.findMany({
      where: {
        eventType: filter.eventType as unknown as Prisma.EmailSecurityAuditEventWhereInput['eventType'],
        documentId: filter.documentId,
        connectedMailboxId: filter.connectedMailboxId,
        inboxMessageId: filter.inboxMessageId,
        userId: filter.userId,
      },
      orderBy: { occurredAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: PrismaEmailSecurityAuditEvent): EmailSecurityAuditEventRecord {
    return {
      id: row.id,
      eventType: row.eventType as unknown as EmailSecurityAuditEventType,
      documentId: row.documentId,
      emailMessageId: row.emailMessageId,
      senderIdentityId: row.senderIdentityId,
      connectedMailboxId: row.connectedMailboxId,
      inboxMessageId: row.inboxMessageId,
      userId: row.userId,
      applicationId: row.applicationId,
      campaignId: row.campaignId,
      detail: row.detail,
      metadata: (row.metadata as unknown as Record<string, string>) ?? {},
      occurredAt: row.occurredAt,
    };
  }
}
