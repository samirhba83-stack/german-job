import { Injectable } from '@nestjs/common';
import type { InboxWatch as PrismaInboxWatch, Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { InboxWatchRepository } from '../../domain/ports/inbox-watch.repository';
import { InboxWatchRecord, CreateInboxWatchInput, InboxWatchUpdatePatch, InboxWatchStatus } from '../../domain/models/inbox-watch';
import { ConnectedMailboxProvider } from '../../../connected-mailbox/domain/models/connected-mailbox';

@Injectable()
export class PrismaInboxWatchRepository implements InboxWatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByConnectedMailboxId(connectedMailboxId: string): Promise<InboxWatchRecord | null> {
    const row = await this.prisma.inboxWatch.findUnique({ where: { connectedMailboxId } });
    return row ? this.toRecord(row) : null;
  }

  async findByProviderWatchId(providerWatchId: string): Promise<InboxWatchRecord | null> {
    const row = await this.prisma.inboxWatch.findFirst({ where: { providerWatchId, status: 'ACTIVE' } });
    return row ? this.toRecord(row) : null;
  }

  async upsert(input: CreateInboxWatchInput, now: Date): Promise<InboxWatchRecord> {
    const row = await this.prisma.inboxWatch.upsert({
      where: { connectedMailboxId: input.connectedMailboxId },
      create: {
        connectedMailboxId: input.connectedMailboxId,
        provider: input.provider as unknown as Prisma.InboxWatchCreateInput['provider'],
        status: 'ACTIVE',
        providerWatchId: input.providerWatchId,
        historyCursor: input.historyCursor,
        expiresAt: input.expiresAt,
        createdAt: now,
        updatedAt: now,
      },
      update: {
        status: 'ACTIVE',
        providerWatchId: input.providerWatchId,
        historyCursor: input.historyCursor,
        expiresAt: input.expiresAt,
        consecutiveFailureCount: 0,
        lastFailureReason: null,
        updatedAt: now,
      },
    });
    return this.toRecord(row);
  }

  async update(id: string, patch: InboxWatchUpdatePatch, now: Date): Promise<InboxWatchRecord> {
    const row = await this.prisma.inboxWatch.update({
      where: { id },
      data: {
        ...(patch.status !== undefined ? { status: patch.status as unknown as Prisma.InboxWatchUpdateInput['status'] } : {}),
        ...(patch.providerWatchId !== undefined ? { providerWatchId: patch.providerWatchId } : {}),
        ...(patch.historyCursor !== undefined ? { historyCursor: patch.historyCursor } : {}),
        ...(patch.expiresAt !== undefined ? { expiresAt: patch.expiresAt } : {}),
        ...(patch.lastRenewedAt !== undefined ? { lastRenewedAt: patch.lastRenewedAt } : {}),
        ...(patch.lastNotificationAt !== undefined ? { lastNotificationAt: patch.lastNotificationAt } : {}),
        ...(patch.consecutiveFailureCount !== undefined ? { consecutiveFailureCount: patch.consecutiveFailureCount } : {}),
        ...(patch.lastFailureReason !== undefined ? { lastFailureReason: patch.lastFailureReason } : {}),
        updatedAt: now,
      },
    });
    return this.toRecord(row);
  }

  async listExpiringBefore(cutoff: Date, limit: number): Promise<InboxWatchRecord[]> {
    const rows = await this.prisma.inboxWatch.findMany({
      where: { status: 'ACTIVE', expiresAt: { lte: cutoff } },
      take: limit,
      orderBy: { expiresAt: 'asc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: PrismaInboxWatch): InboxWatchRecord {
    return {
      id: row.id,
      connectedMailboxId: row.connectedMailboxId,
      provider: row.provider as unknown as ConnectedMailboxProvider,
      status: row.status as unknown as InboxWatchStatus,
      providerWatchId: row.providerWatchId,
      historyCursor: row.historyCursor,
      expiresAt: row.expiresAt,
      lastRenewedAt: row.lastRenewedAt,
      lastNotificationAt: row.lastNotificationAt,
      consecutiveFailureCount: row.consecutiveFailureCount,
      lastFailureReason: row.lastFailureReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
