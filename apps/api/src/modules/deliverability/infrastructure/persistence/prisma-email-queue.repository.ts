import { Injectable } from '@nestjs/common';
import type { EmailMessage as PrismaEmailMessage, Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { EmailAttachmentSpec } from '../../../email-provider/domain/models/email-attachment';
import { EmailQueueRepository } from '../../domain/ports/email-queue.repository';
import { EmailMessageRecord, EmailMessageStatus, EnqueueEmailInput, FrozenAttachmentRef } from '../../domain/models/email-message';

const RETRYABLE_SOURCE_STATUSES: EmailMessageStatus[] = ['QUEUED', 'DEFERRED'];

@Injectable()
export class PrismaEmailQueueRepository implements EmailQueueRepository {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(input: EnqueueEmailInput, now: Date): Promise<EmailMessageRecord> {
    const created = await this.prisma.emailMessage.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      // Idempotent by design: if a row for this key already exists, this call is a no-op
      // (`update: {}`) and simply returns the existing row — never a second send.
      update: {},
      create: {
        idempotencyKey: input.idempotencyKey,
        priority: input.priority as unknown as Prisma.EmailMessageCreateInput['priority'],
        status: 'QUEUED',
        senderName: input.sender.displayName,
        senderEmail: input.sender.emailAddress,
        recipientEmail: input.recipientEmail,
        subject: input.subject,
        plainTextBody: input.plainTextBody,
        htmlBody: input.htmlBody,
        attachmentsMeta: input.attachments as unknown as Prisma.InputJsonValue,
        attachmentRefs: (input.attachmentRefs ?? []) as unknown as Prisma.InputJsonValue,
        senderIdentityId: input.senderIdentityId ?? null,
        maxAttempts: input.maxAttempts,
        correlationId: input.correlationId,
        traceId: input.traceId,
        campaignId: input.campaignId,
        createdAt: now,
        updatedAt: now,
      },
    });
    return this.toRecord(created);
  }

  async findByIdempotencyKey(key: string): Promise<EmailMessageRecord | null> {
    const row = await this.prisma.emailMessage.findUnique({ where: { idempotencyKey: key } });
    return row ? this.toRecord(row) : null;
  }

  async findById(id: string): Promise<EmailMessageRecord | null> {
    const row = await this.prisma.emailMessage.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async findByProviderMessageId(providerId: string, providerMessageId: string): Promise<EmailMessageRecord | null> {
    const row = await this.prisma.emailMessage.findFirst({ where: { providerId, providerMessageId } });
    return row ? this.toRecord(row) : null;
  }

  async claimBatch(limit: number, now: Date): Promise<EmailMessageRecord[]> {
    // Over-fetch candidates since some will lose their claim race under concurrent workers —
    // matches PostgresLeaseLock's own documented rationale for the same conditional-update idiom.
    const candidates = await this.prisma.emailMessage.findMany({
      where: {
        OR: [
          { status: 'QUEUED' },
          { status: 'DEFERRED', nextAttemptAt: { lte: now } },
        ],
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: limit * 3,
    });

    const claimed: EmailMessageRecord[] = [];
    for (const candidate of candidates) {
      if (claimed.length >= limit) break;
      if (!RETRYABLE_SOURCE_STATUSES.includes(candidate.status as EmailMessageStatus)) continue;

      const result = await this.prisma.emailMessage.updateMany({
        where: { id: candidate.id, status: candidate.status },
        data: { status: 'SENDING', attempts: { increment: 1 }, updatedAt: now },
      });
      if (result.count === 1) {
        claimed.push(this.toRecord({ ...candidate, status: 'SENDING', attempts: candidate.attempts + 1, updatedAt: now }));
      }
    }
    return claimed;
  }

  async markSent(id: string, providerId: string, providerMessageId: string | null, now: Date): Promise<void> {
    await this.prisma.emailMessage.update({
      where: { id },
      data: { status: 'SENT', providerId, providerMessageId, updatedAt: now },
    });
  }

  async markDeferredForRetry(id: string, reason: string, nextAttemptAt: Date, now: Date): Promise<void> {
    await this.prisma.emailMessage.update({
      where: { id },
      data: { status: 'DEFERRED', lastFailureReason: reason, nextAttemptAt, updatedAt: now },
    });
  }

  async markDeadLetter(id: string, reason: string, now: Date): Promise<void> {
    await this.prisma.emailMessage.update({
      where: { id },
      data: { status: 'DEAD_LETTER', lastFailureReason: reason, nextAttemptAt: null, updatedAt: now },
    });
  }

  async markSuppressed(id: string, now: Date): Promise<void> {
    await this.prisma.emailMessage.update({
      where: { id },
      data: { status: 'SUPPRESSED', lastFailureReason: 'Recipient is on the suppression list.', updatedAt: now },
    });
  }

  async applyProviderStatus(id: string, status: EmailMessageStatus, now: Date): Promise<void> {
    await this.prisma.emailMessage.update({
      where: { id },
      data: { status: status as unknown as Prisma.EmailMessageUpdateInput['status'], updatedAt: now },
    });
  }

  async listByStatus(status: EmailMessageStatus, limit: number, offset: number): Promise<EmailMessageRecord[]> {
    const rows = await this.prisma.emailMessage.findMany({
      where: { status: status as unknown as Prisma.EmailMessageWhereInput['status'] },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return rows.map((row) => this.toRecord(row));
  }

  async countByStatus(): Promise<Readonly<Record<string, number>>> {
    const grouped = await this.prisma.emailMessage.groupBy({ by: ['status'], _count: { _all: true } });
    return Object.fromEntries(grouped.map((group) => [group.status, group._count._all]));
  }

  private toRecord(row: PrismaEmailMessage): EmailMessageRecord {
    return {
      id: row.id,
      idempotencyKey: row.idempotencyKey,
      priority: row.priority as unknown as EmailMessageRecord['priority'],
      status: row.status as unknown as EmailMessageStatus,
      senderName: row.senderName,
      senderEmail: row.senderEmail,
      recipientEmail: row.recipientEmail,
      subject: row.subject,
      plainTextBody: row.plainTextBody,
      htmlBody: row.htmlBody,
      attachmentsMeta: (row.attachmentsMeta as unknown as EmailAttachmentSpec[]) ?? [],
      attachmentRefs: (row.attachmentRefs as unknown as FrozenAttachmentRef[]) ?? [],
      senderIdentityId: row.senderIdentityId,
      providerId: row.providerId,
      providerMessageId: row.providerMessageId,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      nextAttemptAt: row.nextAttemptAt,
      lastFailureReason: row.lastFailureReason,
      correlationId: row.correlationId,
      traceId: row.traceId,
      campaignId: row.campaignId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
