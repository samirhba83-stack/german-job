import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CompanyIndustry, CompanySize, UserRole } from '@german-job-engine/shared-types';
import { ArchiveCompanyHandler } from './archive-company.handler';
import { ArchiveCompanyCommand } from './archive-company.command';
import { CompanyRepository } from '../../../domain/repositories/company.repository.interface';
import { Company } from '../../../domain/entities/company.entity';
import { CompanyLocation } from '../../../domain/value-objects/company-location.vo';
import { CompanyContact } from '../../../domain/value-objects/company-contact.vo';

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000';

function createCompany(): Company {
  return Company.create(VALID_ID, 'owner-1', {
    name: 'Acme GmbH',
    industry: CompanyIndustry.IT_SOFTWARE,
    size: CompanySize.SMALL,
    location: CompanyLocation.create({ city: 'Berlin', country: 'Germany' }),
    contact: CompanyContact.create({ contactEmail: 'jobs@acme.de' }),
  });
}

describe('ArchiveCompanyHandler', () => {
  let companyRepository: jest.Mocked<CompanyRepository>;
  let eventBus: { publish: jest.Mock };
  let handler: ArchiveCompanyHandler;
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
    handler = new ArchiveCompanyHandler(companyRepository, eventBus as any);
  });

  it('archives the company when the requester is the owner', async () => {
    const result = await handler.execute(new ArchiveCompanyCommand(VALID_ID, 'owner-1', UserRole.EMPLOYER));

    expect(result.status).toBe('ARCHIVED');
    expect(companyRepository.save).toHaveBeenCalledWith(company);
  });

  it('throws ForbiddenException for a non-owner, non-admin requester', async () => {
    await expect(
      handler.execute(new ArchiveCompanyCommand(VALID_ID, 'someone-else', UserRole.EMPLOYER)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when the company does not exist', async () => {
    companyRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new ArchiveCompanyCommand(VALID_ID, 'owner-1', UserRole.EMPLOYER)),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when the company is already archived', async () => {
    company.archive();

    await expect(
      handler.execute(new ArchiveCompanyCommand(VALID_ID, 'owner-1', UserRole.EMPLOYER)),
    ).rejects.toThrow(ConflictException);
  });
});
