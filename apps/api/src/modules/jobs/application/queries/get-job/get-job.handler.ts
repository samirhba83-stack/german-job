import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetJobQuery } from './get-job.query';
import { JOB_REPOSITORY, JobRepository } from '../../../domain/repositories/job.repository.interface';
import { JobId } from '../../../domain/value-objects/job-id.vo';
import { JobResponseDto } from '../../dto/job-response.dto';
import { JobResponseMapper } from '../../dto/job-response.mapper';

@QueryHandler(GetJobQuery)
export class GetJobHandler implements IQueryHandler<GetJobQuery> {
  constructor(@Inject(JOB_REPOSITORY) private readonly jobRepository: JobRepository) {}

  async execute(query: GetJobQuery): Promise<JobResponseDto> {
    try {
      JobId.create(query.jobId);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid job id');
    }

    const job = await this.jobRepository.findById(query.jobId);
    if (!job) {
      throw new NotFoundException(`Job not found: ${query.jobId}`);
    }

    return JobResponseMapper.toDto(job);
  }
}
