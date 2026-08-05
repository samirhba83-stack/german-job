import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ListJobsQuery } from './list-jobs.query';
import { JOB_REPOSITORY, JobRepository } from '../../../domain/repositories/job.repository.interface';
import { JobSearchSpecification } from '../../../domain/specifications/job-search.specification';
import { PaginatedJobsResponseDto } from '../../dto/paginated-jobs-response.dto';
import { JobResponseMapper } from '../../dto/job-response.mapper';

/** Listing is search with no filters applied (published jobs only) — reuses the same repository primitive. */
@QueryHandler(ListJobsQuery)
export class ListJobsHandler implements IQueryHandler<ListJobsQuery> {
  constructor(@Inject(JOB_REPOSITORY) private readonly jobRepository: JobRepository) {}

  async execute(query: ListJobsQuery): Promise<PaginatedJobsResponseDto> {
    const specification = JobSearchSpecification.create({ page: query.page, limit: query.limit });

    const { items, total } = await this.jobRepository.search(specification);

    const dto = new PaginatedJobsResponseDto();
    dto.items = items.map((job) => JobResponseMapper.toDto(job));
    dto.total = total;
    dto.page = specification.page;
    dto.limit = specification.limit;
    return dto;
  }
}
