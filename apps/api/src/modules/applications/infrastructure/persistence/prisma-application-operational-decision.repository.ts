import { Injectable } from '@nestjs/common';
import type { ApplicationOperationalDecision as PrismaOperationalDecision, Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { ApplicationOperationalDecisionRepository } from '../../domain/repositories/application-operational-decision.repository.interface';
import { ApplicationOperationalDecisionRecord, RecordOperationalDecisionInput, ApplicationOperationalDecisionType } from '../../domain/models/application-operational-decision';

@Injectable()
export class PrismaApplicationOperationalDecisionRepository implements ApplicationOperationalDecisionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async recordIfNotDuplicate(input: RecordOperationalDecisionInput, now: Date): Promise<{ readonly decision: ApplicationOperationalDecisionRecord; readonly wasNewlyCreated: boolean }> {
    const existing = await this.prisma.applicationOperationalDecision.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      return { decision: this.toRecord(existing), wasNewlyCreated: false };
    }
    try {
      const created = await this.prisma.applicationOperationalDecision.create({
        data: {
          applicationId: input.applicationId,
          decisionType: input.decisionType as unknown as Prisma.ApplicationOperationalDecisionCreateInput['decisionType'],
          actorType: input.actorType,
          actorId: input.actorId,
          reason: input.reason,
          evidence: input.evidence as unknown as Prisma.InputJsonValue,
          correlationId: input.correlationId,
          idempotencyKey: input.idempotencyKey,
          createdAt: now,
        },
      });
      return { decision: this.toRecord(created), wasNewlyCreated: true };
    } catch (error) {
      const raced = await this.prisma.applicationOperationalDecision.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (raced) return { decision: this.toRecord(raced), wasNewlyCreated: false };
      throw error;
    }
  }

  async listByApplicationId(applicationId: string): Promise<ApplicationOperationalDecisionRecord[]> {
    const rows = await this.prisma.applicationOperationalDecision.findMany({ where: { applicationId }, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: PrismaOperationalDecision): ApplicationOperationalDecisionRecord {
    return {
      id: row.id,
      applicationId: row.applicationId,
      decisionType: row.decisionType as unknown as ApplicationOperationalDecisionType,
      actorType: row.actorType,
      actorId: row.actorId,
      reason: row.reason,
      evidence: row.evidence as unknown as Record<string, unknown> | null,
      correlationId: row.correlationId,
      createdAt: row.createdAt,
      idempotencyKey: row.idempotencyKey,
    };
  }
}
