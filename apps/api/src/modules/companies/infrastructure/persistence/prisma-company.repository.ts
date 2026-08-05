import { Injectable } from '@nestjs/common';
import {
  Prisma,
  CompanyStatus as PrismaCompanyStatus,
  CompanyIndustry as PrismaCompanyIndustry,
  CompanySize as PrismaCompanySize,
  VisaSponsorship as PrismaVisaSponsorship,
} from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  CompanyRepository,
  CompanySearchResult,
} from '../../domain/repositories/company.repository.interface';
import { Company } from '../../domain/entities/company.entity';
import { CompanySearchSpecification } from '../../domain/specifications/company-search.specification';
import { CompanyMapper } from '../mappers/company.mapper';

@Injectable()
export class PrismaCompanyRepository implements CompanyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Company | null> {
    const raw = await this.prisma.company.findUnique({ where: { id } });
    return raw ? CompanyMapper.toDomain(raw) : null;
  }

  async findByOwnerId(ownerId: string): Promise<Company | null> {
    const raw = await this.prisma.company.findUnique({ where: { ownerId } });
    return raw ? CompanyMapper.toDomain(raw) : null;
  }

  async search(specification: CompanySearchSpecification): Promise<CompanySearchResult> {
    const where: Prisma.CompanyWhereInput = {
      status: PrismaCompanyStatus.ACTIVE,
    };

    if (specification.keyword) {
      where.name = { contains: specification.keyword, mode: 'insensitive' };
    }
    if (specification.industry) {
      where.industry = specification.industry as unknown as PrismaCompanyIndustry;
    }
    if (specification.size) {
      where.size = specification.size as unknown as PrismaCompanySize;
    }
    if (specification.city) {
      where.city = { contains: specification.city, mode: 'insensitive' };
    }
    if (specification.visaSponsorship) {
      where.visaSponsorship = specification.visaSponsorship as unknown as PrismaVisaSponsorship;
    }

    const [rows, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip: specification.offset,
        take: specification.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.company.count({ where }),
    ]);

    return { items: rows.map((row) => CompanyMapper.toDomain(row)), total };
  }

  async save(entity: Company): Promise<void> {
    const data = CompanyMapper.toPersistence(entity);

    await this.prisma.company.upsert({
      where: { id: entity.id },
      create: { id: entity.id, ...data },
      update: data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.company.delete({ where: { id } });
  }
}
