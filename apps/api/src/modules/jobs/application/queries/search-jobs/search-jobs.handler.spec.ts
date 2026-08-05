import { EmploymentType, RemotePolicy } from '@german-job-engine/shared-types';
import { SearchJobsHandler } from './search-jobs.handler';
import { SearchJobsQuery } from './search-jobs.query';
import { JobRepository } from '../../../domain/repositories/job.repository.interface';

describe('SearchJobsHandler', () => {
  let jobRepository: jest.Mocked<JobRepository>;
  let handler: SearchJobsHandler;

  beforeEach(() => {
    jobRepository = {
      findById: jest.fn(),
      search: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      save: jest.fn(),
      delete: jest.fn(),
    };
    handler = new SearchJobsHandler(jobRepository);
  });

  it('builds a specification from the query and delegates to the repository', async () => {
    const result = await handler.execute(
      new SearchJobsQuery(
        'engineer',
        'Berlin',
        undefined,
        undefined,
        50000,
        EmploymentType.FULL_TIME,
        undefined,
        RemotePolicy.HYBRID,
        undefined,
        undefined,
        undefined,
        2,
        10,
      ),
    );

    expect(jobRepository.search).toHaveBeenCalledTimes(1);
    const specArg = jobRepository.search.mock.calls[0][0];
    expect(specArg.keyword).toBe('engineer');
    expect(specArg.city).toBe('Berlin');
    expect(specArg.minSalary).toBe(50000);
    expect(specArg.employmentType).toBe(EmploymentType.FULL_TIME);
    expect(specArg.remotePolicy).toBe(RemotePolicy.HYBRID);
    expect(specArg.page).toBe(2);
    expect(specArg.limit).toBe(10);
    expect(result.items).toEqual([]);
  });
});
