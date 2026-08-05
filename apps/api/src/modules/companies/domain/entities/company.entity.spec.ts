import { CompanyIndustry, CompanySize, CompanyStatus, VisaSponsorship, AusbildungSupport } from '@german-job-engine/shared-types';
import { Company } from './company.entity';
import { CompanyLocation } from '../value-objects/company-location.vo';
import { CompanyContact } from '../value-objects/company-contact.vo';
import { CompanyMetadata } from '../value-objects/company-metadata.vo';
import { CompanyCreatedEvent } from '../events/company-created.event';
import { CompanyUpdatedEvent } from '../events/company-updated.event';
import { CompanyArchivedEvent } from '../events/company-archived.event';
import { CompanyRestoredEvent } from '../events/company-restored.event';
import { CompanyAlreadyArchivedException } from '../exceptions/company-already-archived.exception';
import { CompanyNotArchivedException } from '../exceptions/company-not-archived.exception';

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

describe('Company', () => {
  it('starts ACTIVE and raises a CompanyCreatedEvent on creation', () => {
    const company = createCompany();

    expect(company.status).toBe(CompanyStatus.ACTIVE);
    expect(company.isActive()).toBe(true);
    expect(company.domainEvents).toHaveLength(1);
    expect(company.domainEvents[0]).toBeInstanceOf(CompanyCreatedEvent);
  });

  it('rejects an empty name', () => {
    expect(() =>
      Company.create(VALID_ID, 'owner-1', {
        name: '   ',
        industry: CompanyIndustry.IT_SOFTWARE,
        size: CompanySize.SMALL,
        location: CompanyLocation.create({ city: 'Berlin', country: 'Germany' }),
        contact: CompanyContact.create({ contactEmail: 'jobs@acme.de' }),
      }),
    ).toThrow(/requires a name/);
  });

  it('only updates fields that are explicitly provided and raises CompanyUpdatedEvent', () => {
    const company = createCompany();
    company.clearDomainEvents();

    company.update({ name: 'Acme International GmbH' });

    expect(company.name).toBe('Acme International GmbH');
    expect(company.industry).toBe(CompanyIndustry.IT_SOFTWARE);
    expect(company.domainEvents[0]).toBeInstanceOf(CompanyUpdatedEvent);
  });

  it('archives an active company and raises CompanyArchivedEvent', () => {
    const company = createCompany();
    company.clearDomainEvents();

    company.archive();

    expect(company.status).toBe(CompanyStatus.ARCHIVED);
    expect(company.isArchived()).toBe(true);
    expect(company.domainEvents[0]).toBeInstanceOf(CompanyArchivedEvent);
  });

  it('throws when archiving an already-archived company', () => {
    const company = createCompany();
    company.archive();

    expect(() => company.archive()).toThrow(CompanyAlreadyArchivedException);
  });

  it('restores an archived company and raises CompanyRestoredEvent', () => {
    const company = createCompany();
    company.archive();
    company.clearDomainEvents();

    company.restore();

    expect(company.status).toBe(CompanyStatus.ACTIVE);
    expect(company.domainEvents[0]).toBeInstanceOf(CompanyRestoredEvent);
  });

  it('throws when restoring a company that is not archived', () => {
    const company = createCompany();

    expect(() => company.restore()).toThrow(CompanyNotArchivedException);
  });

  it('does not raise domain events when reconstituted from persistence', () => {
    const company = Company.reconstitute(VALID_ID, {
      ownerId: 'owner-1',
      name: 'Acme GmbH',
      status: CompanyStatus.ACTIVE,
      industry: CompanyIndustry.IT_SOFTWARE,
      size: CompanySize.SMALL,
      location: CompanyLocation.create({ city: 'Berlin', country: 'Germany' }),
      website: null,
      contact: CompanyContact.create({ contactEmail: 'jobs@acme.de' }),
      visaSponsorship: VisaSponsorship.NOT_OFFERED,
      ausbildungSupport: AusbildungSupport.NOT_OFFERED,
      hiringQuality: null,
      trustScore: null,
      metadata: CompanyMetadata.empty(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(company.domainEvents).toHaveLength(0);
  });
});
