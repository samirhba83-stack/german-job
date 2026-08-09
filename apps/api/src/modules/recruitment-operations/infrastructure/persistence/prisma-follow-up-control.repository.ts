import { Injectable } from '@nestjs/common';
import type { ApplicationFollowUpControl as PrismaFollowUpControl, Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { FollowUpControlRepository } from '../../domain/ports/follow-up-control.repository';
import { FollowUpControlRecord, CreateFollowUpControlInput, FollowUpControlStatus, FollowUpControlType } from '../../domain/models/follow-up-control';
import { ReplyPrimaryCategory } from '../../../inbox-intelligence/domain/models/reply-taxonomy';

@Injectable()
export class PrismaFollowUpControlRepository implements FollowUpControlRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<FollowUpControlRecord | null> {
    const row = await this.prisma.applicationFollowUpControl.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async findActiveByApplicationId(applicationId: string): Promise<FollowUpControlRecord | null> {
    const row = await this.prisma.applicationFollowUpControl.findFirst({ where: { applicationId, status: 'ACTIVE' } });
    return row ? this.toRecord(row) : null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<FollowUpControlRecord | null> {
    const row = await this.prisma.applicationFollowUpControl.findUnique({ where: { idempotencyKey } });
    return row ? this.toRecord(row) : null;
  }

  /** Real "supersede-then-create" inside one transaction (Non-Negotiable Principle #1: never
   * overwrite historical truth — the prior ACTIVE row is marked SUPERSEDED, never deleted or
   * mutated into the new decision). The partial unique index
   * (`application_follow_up_controls_active_per_application_unique`) is the real backstop against
   * a genuine concurrent race: if two callers both reach this method for the same application at
   * the same moment, the transaction that commits second raises P2002 on its INSERT — the caller
   * (`FollowUpControlService`) re-fetches and treats the winner's row as authoritative. */
  async createSuperseding(input: CreateFollowUpControlInput, now: Date): Promise<FollowUpControlRecord> {
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.applicationFollowUpControl.updateMany({
        where: { applicationId: input.applicationId, status: 'ACTIVE' },
        data: { status: 'SUPERSEDED', updatedAt: now },
      });
      return tx.applicationFollowUpControl.create({
        data: {
          userId: input.userId,
          applicationId: input.applicationId,
          campaignId: input.campaignId,
          companyId: input.companyId,
          jobId: input.jobId,
          sourceInboxMessageId: input.sourceInboxMessageId,
          sourceProviderMessageId: input.sourceProviderMessageId,
          controlType: input.controlType as unknown as Prisma.ApplicationFollowUpControlCreateInput['controlType'],
          status: 'ACTIVE',
          reasonCode: input.reasonCode,
          explanation: input.explanation,
          classification: input.classification as unknown as Prisma.ApplicationFollowUpControlCreateInput['classification'],
          confidence: input.confidence,
          evidence: input.evidence as unknown as Prisma.InputJsonValue,
          createdByActorType: input.createdByActorType,
          createdByActorId: input.createdByActorId,
          createdAt: now,
          effectiveAt: now,
          expiresAt: input.expiresAt,
          correlationId: input.correlationId,
          idempotencyKey: input.idempotencyKey,
          version: 1,
          updatedAt: now,
        },
      });
    });
    return this.toRecord(row);
  }

  async release(id: string, releasedBy: string, releaseReason: string, now: Date): Promise<FollowUpControlRecord> {
    const row = await this.prisma.applicationFollowUpControl.update({
      where: { id },
      data: { status: 'RELEASED', releasedAt: now, releasedBy, releaseReason, updatedAt: now },
    });
    return this.toRecord(row);
  }

  async markExpired(id: string, now: Date): Promise<FollowUpControlRecord> {
    const row = await this.prisma.applicationFollowUpControl.update({ where: { id }, data: { status: 'EXPIRED', updatedAt: now } });
    return this.toRecord(row);
  }

  async markStatus(id: string, status: FollowUpControlStatus, now: Date): Promise<FollowUpControlRecord> {
    const row = await this.prisma.applicationFollowUpControl.update({
      where: { id },
      data: { status: status as unknown as Prisma.ApplicationFollowUpControlUpdateInput['status'], updatedAt: now },
    });
    return this.toRecord(row);
  }

  async listExpiredActive(now: Date, limit: number): Promise<FollowUpControlRecord[]> {
    const rows = await this.prisma.applicationFollowUpControl.findMany({
      where: { status: 'ACTIVE', expiresAt: { lte: now } },
      take: limit,
      orderBy: { expiresAt: 'asc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async listByUserId(userId: string, status: FollowUpControlStatus | undefined, limit: number, offset: number): Promise<FollowUpControlRecord[]> {
    const rows = await this.prisma.applicationFollowUpControl.findMany({
      where: { userId, status: status as unknown as Prisma.ApplicationFollowUpControlWhereInput['status'] },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return rows.map((row) => this.toRecord(row));
  }

  async listActive(limit: number, offset: number): Promise<FollowUpControlRecord[]> {
    const rows = await this.prisma.applicationFollowUpControl.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: limit, skip: offset });
    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: PrismaFollowUpControl): FollowUpControlRecord {
    return {
      id: row.id,
      userId: row.userId,
      applicationId: row.applicationId,
      campaignId: row.campaignId,
      companyId: row.companyId,
      jobId: row.jobId,
      sourceInboxMessageId: row.sourceInboxMessageId,
      sourceProviderMessageId: row.sourceProviderMessageId,
      controlType: row.controlType as unknown as FollowUpControlType,
      status: row.status as unknown as FollowUpControlStatus,
      reasonCode: row.reasonCode,
      explanation: row.explanation,
      classification: row.classification as unknown as ReplyPrimaryCategory | null,
      confidence: row.confidence,
      evidence: row.evidence as unknown as Record<string, unknown> | null,
      createdByActorType: row.createdByActorType,
      createdByActorId: row.createdByActorId,
      createdAt: row.createdAt,
      effectiveAt: row.effectiveAt,
      expiresAt: row.expiresAt,
      releasedAt: row.releasedAt,
      releasedBy: row.releasedBy,
      releaseReason: row.releaseReason,
      correlationId: row.correlationId,
      idempotencyKey: row.idempotencyKey,
      version: row.version,
      updatedAt: row.updatedAt,
    };
  }
}
