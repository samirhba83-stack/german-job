import { Injectable } from '@nestjs/common';
import type { ConnectedMailboxSendAttempt as PrismaSendAttempt, Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { ConnectedMailboxSendAttemptRepository } from '../../domain/ports/connected-mailbox-send-attempt.repository';
import {
  ConnectedMailboxSendAttemptRecord,
  CreateConnectedMailboxSendAttemptInput,
  ConnectedMailboxSendStatus,
  FrozenMailboxAttachmentRef,
} from '../../domain/models/connected-mailbox-send-attempt';
import { ConnectedMailboxProvider } from '../../domain/models/connected-mailbox';

@Injectable()
export class PrismaConnectedMailboxSendAttemptRepository implements ConnectedMailboxSendAttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent via `upsert` on `idempotencyKey` — a repeat reservation call for the same logical
   * send returns the existing frozen row untouched (`update: {}`), matching M28's `EmailQueueRepository.enqueue()`
   * precedent exactly. */
  async reserve(input: CreateConnectedMailboxSendAttemptInput, now: Date): Promise<ConnectedMailboxSendAttemptRecord> {
    const created = await this.prisma.connectedMailboxSendAttempt.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      update: {},
      create: {
        idempotencyKey: input.idempotencyKey,
        connectedMailboxId: input.connectedMailboxId,
        verifiedSenderEmail: input.verifiedSenderEmail,
        provider: input.provider as unknown as Prisma.ConnectedMailboxSendAttemptCreateInput['provider'],
        providerAccountId: input.providerAccountId,
        applicationId: input.applicationId,
        campaignId: input.campaignId,
        recipientEmail: input.recipientEmail,
        subject: input.subject,
        bodyChecksumSha256: input.bodyChecksumSha256,
        attachmentRefs: input.attachmentRefs as unknown as Prisma.InputJsonValue,
        status: 'PENDING',
        correlationId: input.correlationId,
        traceId: input.traceId,
        createdAt: now,
        updatedAt: now,
      },
    });
    return this.toRecord(created);
  }

  async findByIdempotencyKey(key: string): Promise<ConnectedMailboxSendAttemptRecord | null> {
    const row = await this.prisma.connectedMailboxSendAttempt.findUnique({ where: { idempotencyKey: key } });
    return row ? this.toRecord(row) : null;
  }

  async markOutcome(
    id: string,
    status: ConnectedMailboxSendStatus,
    fields: { providerMessageId?: string | null; providerThreadId?: string | null; rfcMessageId?: string | null; lastFailureCategory?: string | null; lastFailureReason?: string | null },
    now: Date,
  ): Promise<void> {
    await this.prisma.connectedMailboxSendAttempt.update({
      where: { id },
      data: {
        status: status as unknown as Prisma.ConnectedMailboxSendAttemptUpdateInput['status'],
        ...(fields.providerMessageId !== undefined ? { providerMessageId: fields.providerMessageId } : {}),
        ...(fields.providerThreadId !== undefined ? { providerThreadId: fields.providerThreadId } : {}),
        ...(fields.rfcMessageId !== undefined ? { rfcMessageId: fields.rfcMessageId } : {}),
        ...(fields.lastFailureCategory !== undefined ? { lastFailureCategory: fields.lastFailureCategory } : {}),
        ...(fields.lastFailureReason !== undefined ? { lastFailureReason: fields.lastFailureReason } : {}),
        updatedAt: now,
      },
    });
  }

  async incrementAttempts(id: string, now: Date): Promise<void> {
    await this.prisma.connectedMailboxSendAttempt.update({ where: { id }, data: { attempts: { increment: 1 }, updatedAt: now } });
  }

  async listByConnectedMailboxId(connectedMailboxId: string, limit: number, offset: number): Promise<ConnectedMailboxSendAttemptRecord[]> {
    const rows = await this.prisma.connectedMailboxSendAttempt.findMany({
      where: { connectedMailboxId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return rows.map((row) => this.toRecord(row));
  }

  async findByProviderThreadId(connectedMailboxId: string, providerThreadId: string): Promise<ConnectedMailboxSendAttemptRecord | null> {
    const row = await this.prisma.connectedMailboxSendAttempt.findFirst({ where: { connectedMailboxId, providerThreadId }, orderBy: { createdAt: 'desc' } });
    return row ? this.toRecord(row) : null;
  }

  async findByRfcMessageId(connectedMailboxId: string, rfcMessageId: string): Promise<ConnectedMailboxSendAttemptRecord | null> {
    const row = await this.prisma.connectedMailboxSendAttempt.findFirst({ where: { connectedMailboxId, rfcMessageId } });
    return row ? this.toRecord(row) : null;
  }

  private toRecord(row: PrismaSendAttempt): ConnectedMailboxSendAttemptRecord {
    return {
      id: row.id,
      idempotencyKey: row.idempotencyKey,
      connectedMailboxId: row.connectedMailboxId,
      verifiedSenderEmail: row.verifiedSenderEmail,
      provider: row.provider as unknown as ConnectedMailboxProvider,
      providerAccountId: row.providerAccountId,
      applicationId: row.applicationId,
      campaignId: row.campaignId,
      recipientEmail: row.recipientEmail,
      subject: row.subject,
      bodyChecksumSha256: row.bodyChecksumSha256,
      attachmentRefs: (row.attachmentRefs as unknown as FrozenMailboxAttachmentRef[]) ?? [],
      status: row.status as unknown as ConnectedMailboxSendStatus,
      providerMessageId: row.providerMessageId,
      providerThreadId: row.providerThreadId,
      rfcMessageId: row.rfcMessageId,
      attempts: row.attempts,
      lastFailureCategory: row.lastFailureCategory,
      lastFailureReason: row.lastFailureReason,
      correlationId: row.correlationId,
      traceId: row.traceId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
