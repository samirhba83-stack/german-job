import { Repository } from '../../../../shared/application';
import { Job } from '../entities/job.entity';
import { JobSearchSpecification } from '../specifications/job-search.specification';

export const JOB_REPOSITORY = Symbol('JOB_REPOSITORY');

export interface JobSearchResult {
  items: Job[];
  total: number;
}

export interface JobRepository extends Repository<Job, string> {
  search(specification: JobSearchSpecification): Promise<JobSearchResult>;
}
