import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetCompanyQuery } from './get-company.query';
import {
  COMPANY_REPOSITORY,
  CompanyRepository,
} from '../../../domain/repositories/company.repository.interface';
import { CompanyId } from '../../../domain/value-objects/company-id.vo';
import { CompanyResponseDto } from '../../dto/company-response.dto';
import { CompanyResponseMapper } from '../../dto/company-response.mapper';

@QueryHandler(GetCompanyQuery)
export class GetCompanyHandler implements IQueryHandler<GetCompanyQuery> {
  constructor(@Inject(COMPANY_REPOSITORY) private readonly companyRepository: CompanyRepository) {}

  async execute(query: GetCompanyQuery): Promise<CompanyResponseDto> {
    try {
      CompanyId.create(query.companyId);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid company id');
    }

    const company = await this.companyRepository.findById(query.companyId);
    if (!company) {
      throw new NotFoundException(`Company not found: ${query.companyId}`);
    }

    return CompanyResponseMapper.toDto(company);
  }
}
