import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CompanyIndustry, CompanySize } from '@german-job-engine/shared-types';
import { GetCompanyHandler } from './get-company.handler';
import { GetCompanyQuery } from './get-company.query';
import { CompanyRepository } from '../../../domain/repositories/company.repository.interface';
import { Company } from '../../../domain/entities/company.entity';
import { CompanyLocation } from '../../../domain/value-objects/company-location.vo';
import { CompanyContact } from '../../../domain/value-objects/company-contact.vo';

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('GetCompanyHandler', () => {
  let companyRepository: jest.Mocked<CompanyRepository>;
  let handler: GetCompanyHandler;

  beforeEach(() => {
    companyRepository = {
      findById: jest.fn(),
      findByOwnerId: jest.fn(),
      search: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    handler = new GetCompanyHandler(companyRepository);
  });

  it('returns the mapped company when it exists', async () => {
    const company = Company.create(VALID_ID, 'owner-1', {
      name: 'Acme GmbH',
      industry: CompanyIndustry.IT_SOFTWARE,
      size: CompanySize.SMALL,
      location: CompanyLocation.create({ city: 'Berlin', country: 'Germany' }),
      contact: CompanyContact.create({ contactEmail: 'jobs@acme.de' }),
    });
    companyRepository.findById.mockResolvedValue(company);

    const result = await handler.execute(new GetCompanyQuery(VALID_ID));

    expect(result.id).toBe(VALID_ID);
    expect(result.name).toBe('Acme GmbH');
  });

  it('throws NotFoundException when the company does not exist', async () => {
    companyRepository.findById.mockResolvedValue(null);

    await expect(handler.execute(new GetCompanyQuery(VALID_ID))).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for a malformed company id', async () => {
    await expect(handler.execute(new GetCompanyQuery('not-a-uuid'))).rejects.toThrow(BadRequestException);
  });
});
