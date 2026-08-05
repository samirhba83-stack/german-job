import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CompanyIndustry, CompanySize, UserRole } from '@german-job-engine/shared-types';
import { UpdateCompanyHandler } from './update-company.handler';
import { UpdateCompanyCommand } from './update-company.command';
import { CompanyRepository } from '../../../domain/repositories/company.repository.interface';
import { Company } from '../../../domain/entities/company.entity';
import { CompanyLocation } from '../../../domain/value-objects/company-location.vo';
import { CompanyContact } from '../../../domain/value-objects/company-contact.vo';

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000';

function createCompany(ownerId = 'owner-1'): Company {
  return Company.create(VALID_ID, ownerId, {
    name: 'Acme GmbH',
    industry: CompanyIndustry.IT_SOFTWARE,
    size: CompanySize.SMALL,
    location: CompanyLocation.create({ city: 'Berlin', country: 'Germany' }),
    contact: CompanyContact.create({ contactEmail: 'jobs@acme.de' }),
  });
}

describe('UpdateCompanyHandler', () => {
  let companyRepository: jest.Mocked<CompanyRepository>;
  let eventBus: { publish: jest.Mock };
  let handler: UpdateCompanyHandler;
  let company: Company;

  beforeEach(() => {
    company = createCompany();
    company.clearDomainEvents();

    companyRepository = {
      findById: jest.fn().mockResolvedValue(company),
      findByOwnerId: jest.fn(),
      search: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    eventBus = { publish: jest.fn() };
    handler = new UpdateCompanyHandler(companyRepository, eventBus as any);
  });

  it('applies changes when the requester is the owner', async () => {
    const result = await handler.execute(
      new UpdateCompanyCommand(VALID_ID, 'owner-1', UserRole.EMPLOYER, { name: 'New Name' }),
    );

    expect(companyRepository.save).toHaveBeenCalledWith(company);
    expect(result.name).toBe('New Name');
  });

  it('allows an admin to update a company they do not own', async () => {
    const result = await handler.execute(
      new UpdateCompanyCommand(VALID_ID, 'someone-else', UserRole.ADMIN, { name: 'Admin Edit' }),
    );

    expect(result.name).toBe('Admin Edit');
  });

  it('throws ForbiddenException when the requester is neither owner nor admin', async () => {
    await expect(
      handler.execute(new UpdateCompanyCommand(VALID_ID, 'someone-else', UserRole.EMPLOYER, { name: 'X' })),
    ).rejects.toThrow(ForbiddenException);
    expect(companyRepository.save).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the company does not exist', async () => {
    companyRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new UpdateCompanyCommand(VALID_ID, 'owner-1', UserRole.EMPLOYER, { name: 'X' })),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for a malformed company id', async () => {
    await expect(
      handler.execute(new UpdateCompanyCommand('not-a-uuid', 'owner-1', UserRole.EMPLOYER, { name: 'X' })),
    ).rejects.toThrow(BadRequestException);
  });

  it('translates invalid nested VO input into BadRequestException', async () => {
    await expect(
      handler.execute(
        new UpdateCompanyCommand(VALID_ID, 'owner-1', UserRole.EMPLOYER, { websiteUrl: 'not-a-url' }),
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
