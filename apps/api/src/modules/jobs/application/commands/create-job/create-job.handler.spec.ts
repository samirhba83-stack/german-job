import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EmploymentType, ContractType, CompanyIndustry, CompanySize } from '@german-job-engine/shared-types';
import { CreateJobHandler } from './create-job.handler';
import { CreateJobCommand } from './create-job.command';
import { JobRepository } from '../../../domain/repositories/job.repository.interface';
import { CompanyRepository } from '../../../../companies/domain/repositories/company.repository.interface';
import { Company } from '../../../../companies/domain/entities/company.entity';
import { CompanyLocation } from '../../../../companies/domain/value-objects/company-location.vo';
import { CompanyContact } from '../../../../companies/domain/value-objects/company-contact.vo';

const VALID_COMPANY_ID = '123e4567-e89b-12d3-a456-426614174000';

function createCompany(): Company {
  return Company.create(VALID_COMPANY_ID, 'owner-1', {
    name: 'Acme GmbH',
    industry: CompanyIndustry.IT_SOFTWARE,
    size: CompanySize.SMALL,
    location: CompanyLocation.create({ city: 'Berlin', country: 'Germany' }),
    contact: CompanyContact.create({ contactEmail: 'jobs@acme.de' }),
  });
}

describe('CreateJobHandler', () => {
  let jobRepository: jest.Mocked<JobRepository>;
  let companyRepository: jest.Mocked<CompanyRepository>;
  let eventBus: { publish: jest.Mock };
  let handler: CreateJobHandler;

  const validData = {
    title: 'Backend Engineer',
    description: 'We are looking for a backend engineer to join our team.',
    employmentType: EmploymentType.FULL_TIME,
    contractType: ContractType.PERMANENT,
    workLocation: { city: 'Berlin', country: 'Germany' },
  };

  beforeEach(() => {
    jobRepository = { findById: jest.fn(), search: jest.fn(), save: jest.fn(), delete: jest.fn() };
    companyRepository = {
      findById: jest.fn(),
      findByOwnerId: jest.fn(),
      search: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    eventBus = { publish: jest.fn() };
    handler = new CreateJobHandler(jobRepository, companyRepository, eventBus as any);
  });

  it('creates a draft job under the requester\'s company', async () => {
    companyRepository.findByOwnerId.mockResolvedValue(createCompany());

    const result = await handler.execute(new CreateJobCommand('owner-1', validData));

    expect(jobRepository.save).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(result.title).toBe('Backend Engineer');
    expect(result.status).toBe('DRAFT');
    expect(result.companyId).toBe(VALID_COMPANY_ID);
  });

  it('throws NotFoundException when the requester has no company', async () => {
    companyRepository.findByOwnerId.mockResolvedValue(null);

    await expect(handler.execute(new CreateJobCommand('owner-1', validData))).rejects.toThrow(NotFoundException);
    expect(jobRepository.save).not.toHaveBeenCalled();
  });

  it('throws ConflictException when the company is archived', async () => {
    const company = createCompany();
    company.archive();
    companyRepository.findByOwnerId.mockResolvedValue(company);

    await expect(handler.execute(new CreateJobCommand('owner-1', validData))).rejects.toThrow(ConflictException);
  });

  it('translates invalid job data into BadRequestException', async () => {
    companyRepository.findByOwnerId.mockResolvedValue(createCompany());

    await expect(
      handler.execute(new CreateJobCommand('owner-1', { ...validData, title: 'AB' })),
    ).rejects.toThrow(BadRequestException);
    expect(jobRepository.save).not.toHaveBeenCalled();
  });
});
