import { Injectable } from '@nestjs/common';
import type { BetaInvitation as PrismaBetaInvitation, Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { BetaInvitationRepository } from '../../domain/ports/beta-invitation.repository';
import { BetaInvitationRecord, BetaInvitationStatus, CreateBetaInvitationInput } from '../../domain/models/beta-invitation';

@Injectable()
export class PrismaBetaInvitationRepository implements BetaInvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateBetaInvitationInput, now: Date): Promise<BetaInvitationRecord> {
    const row = await this.prisma.betaInvitation.create({
      data: {
        email: input.email.toLowerCase(),
        code: input.code,
        invitedByAdminId: input.invitedByAdminId,
        expiresAt: input.expiresAt,
        createdAt: now,
      },
    });
    return this.toRecord(row);
  }

  async findById(id: string): Promise<BetaInvitationRecord | null> {
    const row = await this.prisma.betaInvitation.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async findByCode(code: string): Promise<BetaInvitationRecord | null> {
    const row = await this.prisma.betaInvitation.findUnique({ where: { code } });
    return row ? this.toRecord(row) : null;
  }

  async tryConsume(id: string, usedByUserId: string, now: Date): Promise<BetaInvitationRecord | null> {
    const result = await this.prisma.betaInvitation.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'USED', usedByUserId, usedAt: now },
    });
    if (result.count !== 1) return null;
    return this.findById(id);
  }

  async revoke(id: string, revokedByAdminId: string, reason: string, now: Date): Promise<BetaInvitationRecord> {
    const row = await this.prisma.betaInvitation.update({
      where: { id },
      data: { status: 'REVOKED', revokedByAdminId, revokedReason: reason, revokedAt: now },
    });
    return this.toRecord(row);
  }

  async list(status: BetaInvitationStatus | undefined, limit: number, offset: number): Promise<BetaInvitationRecord[]> {
    const rows = await this.prisma.betaInvitation.findMany({
      where: status ? { status: status as unknown as Prisma.BetaInvitationWhereInput['status'] } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: PrismaBetaInvitation): BetaInvitationRecord {
    return {
      id: row.id,
      email: row.email,
      code: row.code,
      status: row.status as unknown as BetaInvitationStatus,
      invitedByAdminId: row.invitedByAdminId,
      usedByUserId: row.usedByUserId,
      usedAt: row.usedAt,
      revokedAt: row.revokedAt,
      revokedByAdminId: row.revokedByAdminId,
      revokedReason: row.revokedReason,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  }
}
