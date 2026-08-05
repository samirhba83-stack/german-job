import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  EmploymentType,
  ContractType,
  CompanyIndustry,
  CompanySize,
  UserRole,
  Currency,
  SalaryPeriod,
} from '@german-job-engine/shared-types';
import { ReopenJobHandler } from './reopen-job.handler';
import { ReopenJobCommand } from './reopen-job.command';
import { JobRepository } from '../../../domain/repositories/job.repository.interface';
import { Job } from '../../../domain/entities/job.entity';
import { JobTitle } from '../../../domain/value-objects/job-title.vo';
import { JobDescription } from '../../../domain/value-objects/job-description.vo';
import { WorkLocation } from '../../../domain/value-objects/work-location.vo';
import { SalaryRange } from '../../../domain/value-objects/salary-range.vo';
import { CompanyRepository } from '../../../../companies/domain/repositories/company.repository.interface';
import { Company } from '../../../../companies/domain/entities/company.entity';
import { CompanyLocation } from '../../../../companies/domain/value-objects/company-location.vo';
import { CompanyContact } from '../../../../companies/domain/value-objects/company-contact.vo';

const VALID_JOB_ID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_COMPANY_ID = '223e4567-e89b-12d3-a456-426614174000';

function createJob(withSalary: boolean): Job {
  return Job.create(VALID_JOB_ID, VALID_COMPANY_ID, {
    title: JobTitle.create('Backend Engineer'),
    description: JobDescription.create('We are looking for a backend engineer.'),
    employmentType: EmploymentType.FULL_TIME,
    contractType: ContractType.PERMANENT,
    workLocation: WorkLocation.create({ city: 'Berlin', country: 'Germany' }),
    salaryRange: withSalary
      ? SalaryRange.create({ min: 50000, max: 70000, currency: Currency.EUR, period: SalaryPeriod.ANNUAL })
      : undefined,
  });
}

function createCompany(): Company {
  return Company.create(VALID_COMPANY_ID, 'owner-1', {
    name: 'Acme GmbH',
    industry: CompanyIndustry.IT_SOFTWARE,
    size: CompanySize.SMALL,
    location: CompanyLocation.create({ city: 'Berlin', country: 'Germany' }),
    contact: CompanyContact.create({ contactEmail: 'jobs@acme.de' }),
  });
}

describe('ReopenJobHandler', () => {
  let jobRepository: jest.Mocked<JobRepository>;
  let companyRepository: jest.Mocked<CompanyRepository>;
  let eventBus: { publish: jest.Mock };
  let handler: ReopenJobHandler;

  beforeEach(() => {
    companyRepository = {
      findById: jest.fn().mockResolvedValue(createCompany()),
      findByOwnerId: jest.fn(),
      search: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    eventBus = { publish: jest.fn() };
  });

  function buildHandler(job: Job) {
    jobRepository = { findById: jest.fn().mockResolvedValue(job), search: jest.fn(), save: jest.fn(), delete: jest.fn() };
    handler = new ReopenJobHandler(jobRepository, companyRepository, eventBus as any);
  }

  it('reopens an archived job back to published', async () => {
    const job = createJob(true);
    job.publish();
    job.archive();
    buildHandler(job);

    const result = await handler.execute(new ReopenJobCommand(VALID_JOB_ID, 'owner-1', UserRole.EMPLOYER));

    expect(result.status).toBe('PUBLISHED');
  });

  it('reopens a closed job back to published', async () => {
    const job = createJob(true);
    job.publish();
    job.close();
    buildHandler(job);

    const result = await handler.execute(new ReopenJobCommand(VALID_JOB_ID, 'owner-1', UserRole.EMPLOYER));

    expect(result.status).toBe('PUBLISHED');
  });

  it('throws ConflictException when reopening a draft job', async () => {
    buildHandler(createJob(true));

    await expect(
      handler.execute(new ReopenJobCommand(VALID_JOB_ID, 'owner-1', UserRole.EMPLOYER)),
    ).rejects.toThrow(ConflictException);
  });

  it('throws ForbiddenException for a non-owner, non-admin requester', async () => {
    const job = createJob(true);
    job.publish();
    job.archive();
    buildHandler(job);

    await expect(
      handler.execute(new ReopenJobCommand(VALID_JOB_ID, 'someone-else', UserRole.EMPLOYER)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when the job does not exist', async () => {
    buildHandler(createJob(true));
    jobRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new ReopenJobCommand(VALID_JOB_ID, 'owner-1', UserRole.EMPLOYER)),
    ).rejects.toThrow(NotFoundException);
  });

});
