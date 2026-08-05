import { BadRequestException, ConflictException } from '@nestjs/common';
import { CompanyIndustry, CompanySize } from '@german-job-engine/shared-types';
import { CreateCompanyHandler } from './create-company.handler';
import { CreateCompanyCommand } from './create-company.command';
import { CompanyRepository } from '../../../domain/repositories/company.repository.interface';
import { Company } from '../../../domain/entities/company.entity';

describe('CreateCompanyHandler', () => {
  let companyRepository: jest.Mocked<CompanyRepository>;
  let eventBus: { publish: jest.Mock };
  let handler: CreateCompanyHandler;

  const validData = {
    name: 'Acme GmbH',
    industry: CompanyIndustry.IT_SOFTWARE,
    size: CompanySize.SMALL,
    location: { city: 'Berlin', country: 'Germany' },
    contact: { contactEmail: 'jobs@acme.de' },
  };

  beforeEach(() => {
    companyRepository = {
      findById: jest.fn(),
      findByOwnerId: jest.fn(),
      search: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    eventBus = { publish: jest.fn() };
    handler = new CreateCompanyHandler(companyRepository, eventBus as any);
  });

  it('creates and persists a new company when the owner has none yet', async () => {
    companyRepository.findByOwnerId.mockResolvedValue(null);

    const result = await handler.execute(new CreateCompanyCommand('owner-1', validData));

    expect(companyRepository.save).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(result.name).toBe('Acme GmbH');
    expect(result.status).toBe('ACTIVE');
  });

  it('throws ConflictException when the owner already has a company', async () => {
    companyRepository.findByOwnerId.mockResolvedValue({} as Company);

    await expect(handler.execute(new CreateCompanyCommand('owner-1', validData))).rejects.toThrow(
      ConflictException,
    );
    expect(companyRepository.save).not.toHaveBeenCalled();
  });

  it('translates invalid domain data into BadRequestException', async () => {
    companyRepository.findByOwnerId.mockResolvedValue(null);

    await expect(
      handler.execute(
        new CreateCompanyCommand('owner-1', { ...validData, contact: { contactEmail: 'not-an-email' } }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(companyRepository.save).not.toHaveBeenCalled();
  });
});
