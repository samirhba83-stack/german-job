import { Injectable } from '@nestjs/common';
import type { ConnectedMailbox as PrismaConnectedMailbox, Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { ConnectedMailboxRepository } from '../../domain/ports/connected-mailbox.repository';
import {
  ConnectedMailboxRecord,
  ConnectedMailboxUpdatePatch,
  CreateConnectedMailboxInput,
  ConnectedMailboxProvider,
  ConnectedMailboxStatus,
  ConnectedMailboxFailureCategory,
  InboxCapabilityStatus,
} from '../../domain/models/connected-mailbox';

@Injectable()
export class PrismaConnectedMailboxRepository implements ConnectedMailboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ConnectedMailboxRecord | null> {
    const row = await this.prisma.connectedMailbox.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async findActiveByUserId(userId: string): Promise<ConnectedMailboxRecord | null> {
    const row = await this.prisma.connectedMailbox.findFirst({ where: { userId, isActive: true } });
    return row ? this.toRecord(row) : null;
  }

  async findByProviderAccount(provider: ConnectedMailboxProvider, providerAccountId: string): Promise<ConnectedMailboxRecord | null> {
    const row = await this.prisma.connectedMailbox.findFirst({
      where: { provider: provider as unknown as Prisma.ConnectedMailboxWhereInput['provider'], providerAccountId },
      orderBy: { createdAt: 'desc' },
    });
    return row ? this.toRecord(row) : null;
  }

  async findByProviderAndEmailAddress(provider: ConnectedMailboxProvider, emailAddress: string): Promise<ConnectedMailboxRecord | null> {
    const row = await this.prisma.connectedMailbox.findFirst({
      where: { provider: provider as unknown as Prisma.ConnectedMailboxWhereInput['provider'], emailAddress: { equals: emailAddress, mode: 'insensitive' }, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return row ? this.toRecord(row) : null;
  }

  async listByUserId(userId: string): Promise<ConnectedMailboxRecord[]> {
    const rows = await this.prisma.connectedMailbox.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => this.toRecord(row));
  }

  async listAll(limit: number, offset: number): Promise<ConnectedMailboxRecord[]> {
    const rows = await this.prisma.connectedMailbox.findMany({ orderBy: { createdAt: 'desc' }, take: limit, skip: offset });
    return rows.map((row) => this.toRecord(row));
  }

  /** Same real-bug-informed design as M28.5's `CandidateDocument.createNewVersion()`: the
   * transaction deactivates any prior active row before creating the new one, AND a DB-level
   * partial unique index (`connected_mailboxes_active_per_user_unique`) is the real backstop
   * against the exact READ-COMMITTED race that pattern alone cannot fully prevent under genuine
   * concurrency — applied proactively here from the start, not discovered later as a bug. */
  async createConnected(input: CreateConnectedMailboxInput, now: Date): Promise<ConnectedMailboxRecord> {
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.connectedMailbox.updateMany({ where: { userId: input.userId, isActive: true }, data: { isActive: false, updatedAt: now } });

      return tx.connectedMailbox.create({
        data: {
          userId: input.userId,
          provider: input.provider as unknown as Prisma.ConnectedMailboxCreateInput['provider'],
          providerAccountId: input.providerAccountId,
          emailAddress: input.emailAddress,
          displayName: input.displayName,
          isActive: true,
          status: 'CONNECTED',
          grantedScopes: [...input.grantedScopes],
          encryptedRefreshToken: input.encryptedRefreshToken,
          encryptedAccessToken: input.encryptedAccessToken,
          accessTokenExpiresAt: input.accessTokenExpiresAt,
          tokenEncryptionVersion: input.tokenEncryptionVersion,
          hasRefreshToken: input.hasRefreshToken,
          connectedAt: now,
          consentVersion: input.consentVersion,
          consentAcceptedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      });
    });

    return this.toRecord(created);
  }

  async update(id: string, patch: ConnectedMailboxUpdatePatch, now: Date): Promise<ConnectedMailboxRecord> {
    const updated = await this.prisma.connectedMailbox.update({
      where: { id },
      data: {
        ...(patch.status !== undefined ? { status: patch.status as unknown as Prisma.ConnectedMailboxUpdateInput['status'] } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        ...(patch.grantedScopes !== undefined ? { grantedScopes: [...patch.grantedScopes] } : {}),
        ...(patch.encryptedRefreshToken !== undefined ? { encryptedRefreshToken: patch.encryptedRefreshToken } : {}),
        ...(patch.encryptedAccessToken !== undefined ? { encryptedAccessToken: patch.encryptedAccessToken } : {}),
        ...(patch.accessTokenExpiresAt !== undefined ? { accessTokenExpiresAt: patch.accessTokenExpiresAt } : {}),
        ...(patch.tokenEncryptionVersion !== undefined ? { tokenEncryptionVersion: patch.tokenEncryptionVersion } : {}),
        ...(patch.hasRefreshToken !== undefined ? { hasRefreshToken: patch.hasRefreshToken } : {}),
        ...(patch.lastRefreshedAt !== undefined ? { lastRefreshedAt: patch.lastRefreshedAt } : {}),
        ...(patch.lastSuccessfulSendAt !== undefined ? { lastSuccessfulSendAt: patch.lastSuccessfulSendAt } : {}),
        ...(patch.lastFailureAt !== undefined ? { lastFailureAt: patch.lastFailureAt } : {}),
        ...(patch.failureCategory !== undefined ? { failureCategory: patch.failureCategory as unknown as Prisma.ConnectedMailboxUpdateInput['failureCategory'] } : {}),
        ...(patch.failureReason !== undefined ? { failureReason: patch.failureReason } : {}),
        ...(patch.reauthorizationRequired !== undefined ? { reauthorizationRequired: patch.reauthorizationRequired } : {}),
        ...(patch.userDisabled !== undefined ? { userDisabled: patch.userDisabled } : {}),
        ...(patch.systemSuspended !== undefined ? { systemSuspended: patch.systemSuspended } : {}),
        ...(patch.suspensionReason !== undefined ? { suspensionReason: patch.suspensionReason } : {}),
        ...(patch.dailySendCount !== undefined ? { dailySendCount: patch.dailySendCount } : {}),
        ...(patch.dailySendCountResetAt !== undefined ? { dailySendCountResetAt: patch.dailySendCountResetAt } : {}),
        ...(patch.rollingSendCount !== undefined ? { rollingSendCount: patch.rollingSendCount } : {}),
        ...(patch.rollingWindowStartedAt !== undefined ? { rollingWindowStartedAt: patch.rollingWindowStartedAt } : {}),
        ...(patch.inboxCapabilityStatus !== undefined ? { inboxCapabilityStatus: patch.inboxCapabilityStatus as unknown as Prisma.ConnectedMailboxUpdateInput['inboxCapabilityStatus'] } : {}),
        ...(patch.inboxGrantedScopes !== undefined ? { inboxGrantedScopes: [...patch.inboxGrantedScopes] } : {}),
        ...(patch.inboxConsentVersion !== undefined ? { inboxConsentVersion: patch.inboxConsentVersion } : {}),
        ...(patch.inboxConsentAcceptedAt !== undefined ? { inboxConsentAcceptedAt: patch.inboxConsentAcceptedAt } : {}),
        ...(patch.inboxRevokedAt !== undefined ? { inboxRevokedAt: patch.inboxRevokedAt } : {}),
        ...(patch.lastSuccessfulInboxAccessAt !== undefined ? { lastSuccessfulInboxAccessAt: patch.lastSuccessfulInboxAccessAt } : {}),
        ...(patch.inboxReauthorizationRequired !== undefined ? { inboxReauthorizationRequired: patch.inboxReauthorizationRequired } : {}),
        ...(patch.inboxUserDisabled !== undefined ? { inboxUserDisabled: patch.inboxUserDisabled } : {}),
        ...(patch.inboxSystemSuspended !== undefined ? { inboxSystemSuspended: patch.inboxSystemSuspended } : {}),
        ...(patch.inboxSuspensionReason !== undefined ? { inboxSuspensionReason: patch.inboxSuspensionReason } : {}),
        ...(patch.inboxFailureCategory !== undefined ? { inboxFailureCategory: patch.inboxFailureCategory as unknown as Prisma.ConnectedMailboxUpdateInput['inboxFailureCategory'] } : {}),
        ...(patch.inboxFailureReason !== undefined ? { inboxFailureReason: patch.inboxFailureReason } : {}),
        updatedAt: now,
      },
    });
    return this.toRecord(updated);
  }

  private toRecord(row: PrismaConnectedMailbox): ConnectedMailboxRecord {
    return {
      id: row.id,
      userId: row.userId,
      provider: row.provider as unknown as ConnectedMailboxProvider,
      providerAccountId: row.providerAccountId,
      emailAddress: row.emailAddress,
      displayName: row.displayName,
      isActive: row.isActive,
      status: row.status as unknown as ConnectedMailboxStatus,
      grantedScopes: row.grantedScopes,
      tokenEncryptionVersion: row.tokenEncryptionVersion,
      encryptedRefreshToken: row.encryptedRefreshToken,
      encryptedAccessToken: row.encryptedAccessToken,
      accessTokenExpiresAt: row.accessTokenExpiresAt,
      hasRefreshToken: row.hasRefreshToken,
      connectedAt: row.connectedAt,
      lastRefreshedAt: row.lastRefreshedAt,
      lastSuccessfulSendAt: row.lastSuccessfulSendAt,
      lastFailureAt: row.lastFailureAt,
      failureCategory: row.failureCategory as unknown as ConnectedMailboxFailureCategory | null,
      failureReason: row.failureReason,
      reauthorizationRequired: row.reauthorizationRequired,
      userDisabled: row.userDisabled,
      systemSuspended: row.systemSuspended,
      suspensionReason: row.suspensionReason,
      dailySendCount: row.dailySendCount,
      dailySendCountResetAt: row.dailySendCountResetAt,
      rollingSendCount: row.rollingSendCount,
      rollingWindowStartedAt: row.rollingWindowStartedAt,
      providerDailyLimit: row.providerDailyLimit,
      consentVersion: row.consentVersion,
      consentAcceptedAt: row.consentAcceptedAt,
      inboxCapabilityStatus: row.inboxCapabilityStatus as unknown as InboxCapabilityStatus,
      inboxGrantedScopes: row.inboxGrantedScopes,
      inboxConsentVersion: row.inboxConsentVersion,
      inboxConsentAcceptedAt: row.inboxConsentAcceptedAt,
      inboxRevokedAt: row.inboxRevokedAt,
      lastSuccessfulInboxAccessAt: row.lastSuccessfulInboxAccessAt,
      inboxReauthorizationRequired: row.inboxReauthorizationRequired,
      inboxUserDisabled: row.inboxUserDisabled,
      inboxSystemSuspended: row.inboxSystemSuspended,
      inboxSuspensionReason: row.inboxSuspensionReason,
      inboxFailureCategory: row.inboxFailureCategory as unknown as ConnectedMailboxFailureCategory | null,
      inboxFailureReason: row.inboxFailureReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
