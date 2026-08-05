import { Injectable } from '@nestjs/common';
import type { ApplicationTransitionProposal as PrismaProposal, Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { ApplicationTransitionProposalRepository } from '../../domain/ports/application-transition-proposal.repository';
import {
  ApplicationTransitionProposalRecord,
  CreateApplicationTransitionProposalInput,
  ProposedApplicationAction,
  ApplicationTransitionProposalStatus,
} from '../../domain/models/application-transition-proposal';
import { ReplyPrimaryCategory } from '../../domain/models/reply-taxonomy';

@Injectable()
export class PrismaApplicationTransitionProposalRepository implements ApplicationTransitionProposalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ApplicationTransitionProposalRecord | null> {
    const row = await this.prisma.applicationTransitionProposal.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async create(input: CreateApplicationTransitionProposalInput, now: Date): Promise<ApplicationTransitionProposalRecord> {
    const row = await this.prisma.applicationTransitionProposal.create({
      data: {
        inboxMessageId: input.inboxMessageId,
        applicationId: input.applicationId,
        proposedAction: input.proposedAction as unknown as Prisma.ApplicationTransitionProposalCreateInput['proposedAction'],
        classification: input.classification as unknown as Prisma.ApplicationTransitionProposalCreateInput['classification'],
        confidence: input.confidence,
        evidence: input.evidence as unknown as Prisma.InputJsonValue,
        actorType: input.actorType,
        correlationId: input.correlationId,
        createdAt: now,
        updatedAt: now,
      },
    });
    return this.toRecord(row);
  }

  async markConfirmed(id: string, confirmedByUserId: string, now: Date): Promise<ApplicationTransitionProposalRecord> {
    const row = await this.prisma.applicationTransitionProposal.update({ where: { id }, data: { status: 'CONFIRMED', confirmedByUserId, confirmedAt: now, updatedAt: now } });
    return this.toRecord(row);
  }

  async markRejected(id: string, rejectedByUserId: string, now: Date): Promise<ApplicationTransitionProposalRecord> {
    const row = await this.prisma.applicationTransitionProposal.update({ where: { id }, data: { status: 'REJECTED', rejectedByUserId, rejectedAt: now, updatedAt: now } });
    return this.toRecord(row);
  }

  async listByApplicationId(applicationId: string): Promise<ApplicationTransitionProposalRecord[]> {
    const rows = await this.prisma.applicationTransitionProposal.findMany({ where: { applicationId }, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => this.toRecord(row));
  }

  async listPending(limit: number, offset: number): Promise<ApplicationTransitionProposalRecord[]> {
    const rows = await this.prisma.applicationTransitionProposal.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: limit, skip: offset });
    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: PrismaProposal): ApplicationTransitionProposalRecord {
    return {
      id: row.id,
      inboxMessageId: row.inboxMessageId,
      applicationId: row.applicationId,
      proposedAction: row.proposedAction as unknown as ProposedApplicationAction,
      classification: row.classification as unknown as ReplyPrimaryCategory | null,
      confidence: row.confidence,
      evidence: row.evidence as unknown as Record<string, unknown> | null,
      actorType: row.actorType,
      status: row.status as unknown as ApplicationTransitionProposalStatus,
      confirmedByUserId: row.confirmedByUserId,
      confirmedAt: row.confirmedAt,
      rejectedByUserId: row.rejectedByUserId,
      rejectedAt: row.rejectedAt,
      correlationId: row.correlationId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
