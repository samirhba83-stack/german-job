import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SearchJobsQuery } from './search-jobs.query';
import { JOB_REPOSITORY, JobRepository } from '../../../domain/repositories/job.repository.interface';
import { JobSearchSpecification } from '../../../domain/specifications/job-search.specification';
import { PaginatedJobsResponseDto } from '../../dto/paginated-jobs-response.dto';
import { JobResponseMapper } from '../../dto/job-response.mapper';

@QueryHandler(SearchJobsQuery)
export class SearchJobsHandler implements IQueryHandler<SearchJobsQuery> {
  constructor(@Inject(JOB_REPOSITORY) private readonly jobRepository: JobRepository) {}

  async execute(query: SearchJobsQuery): Promise<PaginatedJobsResponseDto> {
    const specification = JobSearchSpecification.create({
      keyword: query.keyword,
      city: query.city,
      companyId: query.companyId,
      industry: query.industry,
      minSalary: query.minSalary,
      employmentType: query.employmentType,
      contractType: query.contractType,
      remotePolicy: query.remotePolicy,
      visaSponsorship: query.visaSponsorship,
      ausbildungOnly: query.ausbildungOnly,
      germanLevel: query.germanLevel,
      page: query.page,
      limit: query.limit,
    });

    const { items, total } = await this.jobRepository.search(specification);

    const dto = new PaginatedJobsResponseDto();
    dto.items = items.map((job) => JobResponseMapper.toDto(job));
    dto.total = total;
    dto.page = specification.page;
    dto.limit = specification.limit;
    return dto;
  }
}
