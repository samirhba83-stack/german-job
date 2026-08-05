import { Injectable } from '@nestjs/common';
import type { OAuthTransaction as PrismaOAuthTransaction, Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { OAuthTransactionRepository } from '../../domain/ports/oauth-transaction.repository';
import { OAuthTransactionRecord, CreateOAuthTransactionInput, OAuthTransactionStatus, OAuthCapabilityPurpose } from '../../domain/models/oauth-transaction';
import { ConnectedMailboxProvider } from '../../domain/models/connected-mailbox';

@Injectable()
export class PrismaOAuthTransactionRepository implements OAuthTransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateOAuthTransactionInput, now: Date): Promise<OAuthTransactionRecord> {
    const created = await this.prisma.oAuthTransaction.create({
      data: {
        state: input.state,
        userId: input.userId,
        provider: input.provider as unknown as Prisma.OAuthTransactionCreateInput['provider'],
        capability: input.capability as unknown as Prisma.OAuthTransactionCreateInput['capability'],
        codeVerifier: input.codeVerifier,
        redirectUri: input.redirectUri,
        status: 'PENDING',
        expiresAt: input.expiresAt,
        createdAt: now,
      },
    });
    return this.toRecord(created);
  }

  async findByState(state: string): Promise<OAuthTransactionRecord | null> {
    const row = await this.prisma.oAuthTransaction.findUnique({ where: { state } });
    return row ? this.toRecord(row) : null;
  }

  /** The real single-use/replay defense — a conditional update that only succeeds if the row is
   * still `status: PENDING`; `count === 1` means this exact call won the race, matching the same
   * idiom `PostgresLeaseLock`/`EmailQueueRepository.claimBatch()` already established. */
  async tryConsume(state: string, now: Date): Promise<boolean> {
    const result = await this.prisma.oAuthTransaction.updateMany({
      where: { state, status: 'PENDING' },
      data: { status: 'CONSUMED', consumedAt: now },
    });
    return result.count === 1;
  }

  private toRecord(row: PrismaOAuthTransaction): OAuthTransactionRecord {
    return {
      id: row.id,
      state: row.state,
      userId: row.userId,
      provider: row.provider as unknown as ConnectedMailboxProvider,
      capability: row.capability as unknown as OAuthCapabilityPurpose,
      codeVerifier: row.codeVerifier,
      redirectUri: row.redirectUri,
      status: row.status as unknown as OAuthTransactionStatus,
      expiresAt: row.expiresAt,
      consumedAt: row.consumedAt,
      createdAt: row.createdAt,
    };
  }
}
