import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SearchCompaniesQuery } from './search-companies.query';
import {
  COMPANY_REPOSITORY,
  CompanyRepository,
} from '../../../domain/repositories/company.repository.interface';
import { CompanySearchSpecification } from '../../../domain/specifications/company-search.specification';
import { PaginatedCompaniesResponseDto } from '../../dto/paginated-companies-response.dto';
import { CompanyResponseMapper } from '../../dto/company-response.mapper';

@QueryHandler(SearchCompaniesQuery)
export class SearchCompaniesHandler implements IQueryHandler<SearchCompaniesQuery> {
  constructor(@Inject(COMPANY_REPOSITORY) private readonly companyRepository: CompanyRepository) {}

  async execute(query: SearchCompaniesQuery): Promise<PaginatedCompaniesResponseDto> {
    const specification = CompanySearchSpecification.create({
      keyword: query.keyword,
      industry: query.industry,
      size: query.size,
      city: query.city,
      visaSponsorship: query.visaSponsorship,
      page: query.page,
      limit: query.limit,
    });

    const { items, total } = await this.companyRepository.search(specification);

    const dto = new PaginatedCompaniesResponseDto();
    dto.items = items.map((company) => CompanyResponseMapper.toDto(company));
    dto.total = total;
    dto.page = specification.page;
    dto.limit = specification.limit;
    return dto;
  }
}
