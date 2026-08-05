import { Injectable } from '@nestjs/common';
import { Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  ApplicationRepository,
  ApplicationSearchResult,
} from '../../domain/repositories/application.repository.interface';
import { Application } from '../../domain/entities/application.entity';
import { ApplicationSearchSpecification } from '../../domain/specifications/application-search.specification';
import { ApplicationMapper } from '../mappers/application.mapper';

const WITH_TIMELINE = { timeline: true } as const;

@Injectable()
export class PrismaApplicationRepository implements ApplicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Application | null> {
    const raw = await this.prisma.application.findUnique({ where: { id }, include: WITH_TIMELINE });
    return raw ? ApplicationMapper.toDomain(raw) : null;
  }

  async findByCandidateId(candidateId: string): Promise<Application[]> {
    const rows = await this.prisma.application.findMany({
      where: { candidateId },
      include: WITH_TIMELINE,
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ApplicationMapper.toDomain(row));
  }

  async search(specification: ApplicationSearchSpecification): Promise<ApplicationSearchResult> {
    const where: Prisma.ApplicationWhereInput = {};

    if (specification.candidateId) {
      where.candidateId = specification.candidateId;
    }
    if (specification.jobId) {
      where.jobId = specification.jobId;
    }
    if (specification.companyId) {
      where.companyId = specification.companyId;
    }
    if (specification.status) {
      where.status = specification.status as unknown as Prisma.ApplicationWhereInput['status'];
    }
    if (specification.channelType) {
      where.channelType = specification.channelType as unknown as Prisma.ApplicationWhereInput['channelType'];
    }
    if (specification.createdFrom || specification.createdTo) {
      where.createdAt = {
        ...(specification.createdFrom ? { gte: specification.createdFrom } : {}),
        ...(specification.createdTo ? { lte: specification.createdTo } : {}),
      };
    }

    // findMany + count in one transaction so pagination is drawn from a single consistent
    // snapshot even under concurrent writes — same pattern as Jobs/Companies search.
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.application.findMany({
        where,
        include: WITH_TIMELINE,
        skip: specification.offset,
        take: specification.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.application.count({ where }),
    ]);

    return { items: rows.map((row) => ApplicationMapper.toDomain(row)), total };
  }

  async save(entity: Application): Promise<void> {
    const data = ApplicationMapper.toPersistence(entity);
    const timelineEntries = ApplicationMapper.toPersistenceTimelineEntries(entity);

    await this.prisma.$transaction([
      this.prisma.application.upsert({
        where: { id: entity.id },
        create: { id: entity.id, ...data },
        update: data,
      }),
      this.prisma.timelineEntry.createMany({ data: timelineEntries, skipDuplicates: true }),
    ]);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.application.delete({ where: { id } });
  }
}
