import { Injectable } from '@nestjs/common';
import { Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { CampaignRepository, CampaignSearchResult } from '../../domain/repositories/campaign.repository.interface';
import { Campaign } from '../../domain/entities/campaign.entity';
import { CampaignSearchSpecification } from '../../domain/specifications/campaign-search.specification';
import { CampaignMapper } from '../mappers/campaign.mapper';
import { ConcurrentModificationException } from '../../domain/exceptions/concurrent-modification.exception';

const WITH_RELATIONS = {
  targets: { include: { dispatchAttempts: true } },
  batches: true,
  companyMemory: true,
  timeline: true,
} as const;

@Injectable()
export class PrismaCampaignRepository implements CampaignRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Campaign | null> {
    const raw = await this.prisma.campaign.findUnique({ where: { id }, include: WITH_RELATIONS });
    return raw ? CampaignMapper.toDomain(raw) : null;
  }

  async findByOwnerId(ownerId: string): Promise<Campaign[]> {
    const rows = await this.prisma.campaign.findMany({
      where: { ownerId },
      include: WITH_RELATIONS,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => CampaignMapper.toDomain(row));
  }

  async search(specification: CampaignSearchSpecification): Promise<CampaignSearchResult> {
    const where: Prisma.CampaignWhereInput = {};

    if (specification.ownerId) {
      where.ownerId = specification.ownerId;
    }
    if (specification.status) {
      where.status = specification.status as unknown as Prisma.CampaignWhereInput['status'];
    }
    if (specification.strategyType) {
      where.strategyType = specification.strategyType as unknown as Prisma.CampaignWhereInput['strategyType'];
    }
    if (specification.createdFrom || specification.createdTo) {
      where.createdAt = {
        ...(specification.createdFrom ? { gte: specification.createdFrom } : {}),
        ...(specification.createdTo ? { lte: specification.createdTo } : {}),
      };
    }

    // findMany + count in one transaction so pagination is drawn from a single consistent
    // snapshot even under concurrent writes — same pattern as every other search-capable module.
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.campaign.findMany({
        where,
        include: WITH_RELATIONS,
        skip: specification.offset,
        take: specification.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return { items: rows.map((row) => CampaignMapper.toDomain(row)), total };
  }

  async save(entity: Campaign): Promise<void> {
    const data = CampaignMapper.toPersistence(entity);
    const targets = CampaignMapper.toPersistenceTargets(entity);
    const dispatchAttempts = CampaignMapper.toPersistenceDispatchAttempts(entity);
    const batches = CampaignMapper.toPersistenceBatches(entity);
    const companyMemory = CampaignMapper.toPersistenceCompanyMemory(entity);
    const timelineEntries = CampaignMapper.toPersistenceTimelineEntries(entity);

    // Interactive (callback) transaction — not the array form — because the version-checked
    // update's result has to be inspected *inside* the transaction to decide whether to abort.
    // A version mismatch must roll back the whole save, including target/batch/company-memory
    // upserts already queued in this call, not just silently no-op the campaign row while
    // everything else commits.
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.campaign.findUnique({ where: { id: entity.id }, select: { id: true } });

      if (!existing) {
        await tx.campaign.create({ data: { id: entity.id, version: 0, ...data } });
      } else {
        const result = await tx.campaign.updateMany({
          where: { id: entity.id, version: entity.version },
          data: { ...data, version: { increment: 1 } },
        });
        if (result.count === 0) {
          throw new ConcurrentModificationException(entity.id);
        }
      }

      // Targets/Batches/CompanyMemory are mutable (status, counters, selections change over
      // their lifetime) so each row is upserted individually. DispatchAttempts and
      // TimelineEntries are immutable/append-only, so createMany + skipDuplicates is sufficient
      // and cheaper — identical convention to the Application Lifecycle Engine's Timeline.
      for (const target of targets) {
        await tx.campaignTarget.upsert({ where: { id: target.id as string }, create: target, update: target });
      }
      for (const batch of batches) {
        await tx.batch.upsert({ where: { id: batch.id as string }, create: batch, update: batch });
      }
      for (const entry of companyMemory) {
        await tx.companyMemoryEntry.upsert({
          where: { campaignId_companyId: { campaignId: entry.campaignId, companyId: entry.companyId } },
          create: entry,
          update: entry,
        });
      }
      if (dispatchAttempts.length > 0) {
        await tx.dispatchAttempt.createMany({ data: dispatchAttempts, skipDuplicates: true });
      }
      if (timelineEntries.length > 0) {
        await tx.campaignTimelineEntry.createMany({ data: timelineEntries, skipDuplicates: true });
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.campaign.delete({ where: { id } });
  }
}
