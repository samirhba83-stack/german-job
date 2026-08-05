import { Injectable } from '@nestjs/common';
import {
  Prisma,
  EmploymentType as PrismaEmploymentType,
  ContractType as PrismaContractType,
  RemotePolicy as PrismaRemotePolicy,
  VisaSponsorship as PrismaVisaSponsorship,
  GermanLevel as PrismaGermanLevel,
} from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { JobRepository, JobSearchResult } from '../../domain/repositories/job.repository.interface';
import { Job } from '../../domain/entities/job.entity';
import { JobSearchSpecification } from '../../domain/specifications/job-search.specification';
import { JobMapper } from '../mappers/job.mapper';

@Injectable()
export class PrismaJobRepository implements JobRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Job | null> {
    const raw = await this.prisma.jobListing.findUnique({ where: { id } });
    return raw ? JobMapper.toDomain(raw) : null;
  }

  async search(specification: JobSearchSpecification): Promise<JobSearchResult> {
    const where: Prisma.JobListingWhereInput = {
      status: specification.status as unknown as Prisma.JobListingWhereInput['status'],
    };

    if (specification.keyword) {
      where.title = { contains: specification.keyword, mode: 'insensitive' };
    }
    if (specification.city) {
      where.city = { contains: specification.city, mode: 'insensitive' };
    }
    if (specification.companyId) {
      where.companyId = specification.companyId;
    }
    if (specification.industry) {
      where.company = { industry: specification.industry as unknown as Prisma.CompanyWhereInput['industry'] };
    }
    if (specification.minSalary !== null) {
      where.salaryMax = { gte: specification.minSalary };
    }
    if (specification.employmentType) {
      where.employmentType = specification.employmentType as unknown as PrismaEmploymentType;
    }
    if (specification.contractType) {
      where.contractType = specification.contractType as unknown as PrismaContractType;
    }
    if (specification.remotePolicy) {
      where.remotePolicy = specification.remotePolicy as unknown as PrismaRemotePolicy;
    }
    if (specification.visaSponsorship) {
      where.visaSponsorshipAvailable = specification.visaSponsorship as unknown as PrismaVisaSponsorship;
    }
    if (specification.ausbildungOnly) {
      where.isAusbildungPosition = true;
    }
    if (specification.germanLevel) {
      where.germanLevelRequired = specification.germanLevel as unknown as PrismaGermanLevel;
    }

    // Runs findMany + count as a single DB transaction so pagination is drawn from one
    // consistent snapshot even under concurrent writes — important at high write volume.
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.jobListing.findMany({
        where,
        skip: specification.offset,
        take: specification.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.jobListing.count({ where }),
    ]);

    return { items: rows.map((row) => JobMapper.toDomain(row)), total };
  }

  async save(entity: Job): Promise<void> {
    const data = JobMapper.toPersistence(entity);

    await this.prisma.jobListing.upsert({
      where: { id: entity.id },
      create: { id: entity.id, ...data },
      update: data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.jobListing.delete({ where: { id } });
  }
}
