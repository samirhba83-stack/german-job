import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EmploymentType, ContractType } from '@german-job-engine/shared-types';
import { GetJobHandler } from './get-job.handler';
import { GetJobQuery } from './get-job.query';
import { JobRepository } from '../../../domain/repositories/job.repository.interface';
import { Job } from '../../../domain/entities/job.entity';
import { JobTitle } from '../../../domain/value-objects/job-title.vo';
import { JobDescription } from '../../../domain/value-objects/job-description.vo';
import { WorkLocation } from '../../../domain/value-objects/work-location.vo';

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('GetJobHandler', () => {
  let jobRepository: jest.Mocked<JobRepository>;
  let handler: GetJobHandler;

  beforeEach(() => {
    jobRepository = { findById: jest.fn(), search: jest.fn(), save: jest.fn(), delete: jest.fn() };
    handler = new GetJobHandler(jobRepository);
  });

  it('returns the mapped job when it exists', async () => {
    const job = Job.create(VALID_ID, 'company-1', {
      title: JobTitle.create('Backend Engineer'),
      description: JobDescription.create('We are looking for a backend engineer.'),
      employmentType: EmploymentType.FULL_TIME,
      contractType: ContractType.PERMANENT,
      workLocation: WorkLocation.create({ city: 'Berlin', country: 'Germany' }),
    });
    jobRepository.findById.mockResolvedValue(job);

    const result = await handler.execute(new GetJobQuery(VALID_ID));

    expect(result.id).toBe(VALID_ID);
    expect(result.title).toBe('Backend Engineer');
  });

  it('throws NotFoundException when the job does not exist', async () => {
    jobRepository.findById.mockResolvedValue(null);

    await expect(handler.execute(new GetJobQuery(VALID_ID))).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for a malformed job id', async () => {
    await expect(handler.execute(new GetJobQuery('not-a-uuid'))).rejects.toThrow(BadRequestException);
  });
});
