import { JobStatus } from '@german-job-engine/shared-types';
import { ListJobsHandler } from './list-jobs.handler';
import { ListJobsQuery } from './list-jobs.query';
import { JobRepository } from '../../../domain/repositories/job.repository.interface';

describe('ListJobsHandler', () => {
  let jobRepository: jest.Mocked<JobRepository>;
  let handler: ListJobsHandler;

  beforeEach(() => {
    jobRepository = {
      findById: jest.fn(),
      search: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      save: jest.fn(),
      delete: jest.fn(),
    };
    handler = new ListJobsHandler(jobRepository);
  });

  it('delegates to the repository defaulting to published jobs only', async () => {
    const result = await handler.execute(new ListJobsQuery(1, 20));

    expect(jobRepository.search).toHaveBeenCalledTimes(1);
    const specArg = jobRepository.search.mock.calls[0][0];
    expect(specArg.status).toBe(JobStatus.PUBLISHED);
    expect(specArg.keyword).toBeNull();
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });
});
