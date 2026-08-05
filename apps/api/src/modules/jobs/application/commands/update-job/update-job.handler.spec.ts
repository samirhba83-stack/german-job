import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  EmploymentType,
  ContractType,
  CompanyIndustry,
  CompanySize,
  UserRole,
  Currency,
  SalaryPeriod,
} from '@german-job-engine/shared-types';
import { UpdateJobHandler } from './update-job.handler';
import { UpdateJobCommand } from './update-job.command';
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

function createJob(): Job {
  return Job.create(VALID_JOB_ID, VALID_COMPANY_ID, {
    title: JobTitle.create('Backend Engineer'),
    description: JobDescription.create('We are looking for a backend engineer.'),
    employmentType: EmploymentType.FULL_TIME,
    contractType: ContractType.PERMANENT,
    workLocation: WorkLocation.create({ city: 'Berlin', country: 'Germany' }),
    salaryRange: SalaryRange.create({ min: 50000, max: 70000, currency: Currency.EUR, period: SalaryPeriod.ANNUAL }),
  });
}

function createCompany(ownerId = 'owner-1'): Company {
  return Company.create(VALID_COMPANY_ID, ownerId, {
    name: 'Acme GmbH',
    industry: CompanyIndustry.IT_SOFTWARE,
    size: CompanySize.SMALL,
    location: CompanyLocation.create({ city: 'Berlin', country: 'Germany' }),
    contact: CompanyContact.create({ contactEmail: 'jobs@acme.de' }),
  });
}

describe('UpdateJobHandler', () => {
  let jobRepository: jest.Mocked<JobRepository>;
  let companyRepository: jest.Mocked<CompanyRepository>;
  let eventBus: { publish: jest.Mock };
  let handler: UpdateJobHandler;
  let job: Job;

  beforeEach(() => {
    job = createJob();
    job.clearDomainEvents();

    jobRepository = {
      findById: jest.fn().mockResolvedValue(job),
      search: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    companyRepository = {
      findById: jest.fn().mockResolvedValue(createCompany()),
      findByOwnerId: jest.fn(),
      search: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    eventBus = { publish: jest.fn() };
    handler = new UpdateJobHandler(jobRepository, companyRepository, eventBus as any);
  });

  it('applies changes when the requester owns the job\'s company', async () => {
    const result = await handler.execute(
      new UpdateJobCommand(VALID_JOB_ID, 'owner-1', UserRole.EMPLOYER, { title: 'Senior Backend Engineer' }),
    );

    expect(jobRepository.save).toHaveBeenCalledWith(job);
    expect(result.title).toBe('Senior Backend Engineer');
  });

  it('allows an admin to update a job they do not own', async () => {
    const result = await handler.execute(
      new UpdateJobCommand(VALID_JOB_ID, 'someone-else', UserRole.ADMIN, { title: 'Admin Edit' }),
    );

    expect(result.title).toBe('Admin Edit');
  });

  it('throws ForbiddenException for a non-owner, non-admin requester', async () => {
    await expect(
      handler.execute(new UpdateJobCommand(VALID_JOB_ID, 'someone-else', UserRole.EMPLOYER, { title: 'X' })),
    ).rejects.toThrow(ForbiddenException);
    expect(jobRepository.save).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the job does not exist', async () => {
    jobRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new UpdateJobCommand(VALID_JOB_ID, 'owner-1', UserRole.EMPLOYER, { title: 'X' })),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for a malformed job id', async () => {
    await expect(
      handler.execute(new UpdateJobCommand('not-a-uuid', 'owner-1', UserRole.EMPLOYER, { title: 'X' })),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws ConflictException when editing a closed job without admin override', async () => {
    job.publish();
    job.close();

    await expect(
      handler.execute(new UpdateJobCommand(VALID_JOB_ID, 'owner-1', UserRole.EMPLOYER, { title: 'New Title' })),
    ).rejects.toThrow(ConflictException);
  });

  it('allows editing a closed job with admin override', async () => {
    job.publish();
    job.close();

    const result = await handler.execute(
      new UpdateJobCommand(VALID_JOB_ID, 'admin-1', UserRole.ADMIN, { title: 'Reopened Edit' }),
    );

    expect(result.title).toBe('Reopened Edit');
  });
});
