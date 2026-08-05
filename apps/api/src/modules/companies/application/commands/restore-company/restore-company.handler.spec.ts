import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CompanyIndustry, CompanySize, UserRole } from '@german-job-engine/shared-types';
import { RestoreCompanyHandler } from './restore-company.handler';
import { RestoreCompanyCommand } from './restore-company.command';
import { CompanyRepository } from '../../../domain/repositories/company.repository.interface';
import { Company } from '../../../domain/entities/company.entity';
import { CompanyLocation } from '../../../domain/value-objects/company-location.vo';
import { CompanyContact } from '../../../domain/value-objects/company-contact.vo';

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000';

function createArchivedCompany(): Company {
  const company = Company.create(VALID_ID, 'owner-1', {
    name: 'Acme GmbH',
    industry: CompanyIndustry.IT_SOFTWARE,
    size: CompanySize.SMALL,
    location: CompanyLocation.create({ city: 'Berlin', country: 'Germany' }),
    contact: CompanyContact.create({ contactEmail: 'jobs@acme.de' }),
  });
  company.archive();
  company.clearDomainEvents();
  return company;
}

describe('RestoreCompanyHandler', () => {
  let companyRepository: jest.Mocked<CompanyRepository>;
  let eventBus: { publish: jest.Mock };
  let handler: RestoreCompanyHandler;
  let company: Company;

  beforeEach(() => {
    company = createArchivedCompany();

    companyRepository = {
      findById: jest.fn().mockResolvedValue(company),
      findByOwnerId: jest.fn(),
      search: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    eventBus = { publish: jest.fn() };
    handler = new RestoreCompanyHandler(companyRepository, eventBus as any);
  });

  it('restores the company when the requester is the owner', async () => {
    const result = await handler.execute(new RestoreCompanyCommand(VALID_ID, 'owner-1', UserRole.EMPLOYER));

    expect(result.status).toBe('ACTIVE');
    expect(companyRepository.save).toHaveBeenCalledWith(company);
  });

  it('throws ForbiddenException for a non-owner, non-admin requester', async () => {
    await expect(
      handler.execute(new RestoreCompanyCommand(VALID_ID, 'someone-else', UserRole.EMPLOYER)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when the company does not exist', async () => {
    companyRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new RestoreCompanyCommand(VALID_ID, 'owner-1', UserRole.EMPLOYER)),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when the company is not archived', async () => {
    company.restore();

    await expect(
      handler.execute(new RestoreCompanyCommand(VALID_ID, 'owner-1', UserRole.EMPLOYER)),
    ).rejects.toThrow(ConflictException);
  });
});
