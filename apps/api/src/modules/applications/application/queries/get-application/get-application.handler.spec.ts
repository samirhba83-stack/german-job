import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ActorRole } from '@german-job-engine/shared-types';
import { GetApplicationHandler } from './get-application.handler';
import { GetApplicationQuery } from './get-application.query';
import { ApplicationRepository } from '../../../domain/repositories/application.repository.interface';
import { Application } from '../../../domain/entities/application.entity';
import { ApplicationSnapshot } from '../../../domain/value-objects/application-snapshot.vo';
import { ApplicationChannel } from '../../../domain/value-objects/application-channel.vo';
import { Actor } from '../../../domain/value-objects/actor.vo';
import { CorrelationId } from '../../../domain/value-objects/correlation-id.vo';
import { CompanyRepository } from '../../../../companies/domain/repositories/company.repository.interface';

const APPLICATION_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('GetApplicationHandler', () => {
  let applicationRepository: jest.Mocked<ApplicationRepository>;
  let companyRepository: jest.Mocked<CompanyRepository>;
  let handler: GetApplicationHandler;

  beforeEach(() => {
    applicationRepository = {
      findById: jest.fn(),
      findByCandidateId: jest.fn(),
      search: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    companyRepository = {
      findById: jest.fn(),
      findByOwnerId: jest.fn(),
      search: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    handler = new GetApplicationHandler(applicationRepository, companyRepository);
  });

  function seedApplication() {
    applicationRepository.findById.mockResolvedValue(
      Application.create(
        APPLICATION_ID,
        'candidate-1',
        'job-1',
        'company-1',
        ApplicationSnapshot.create({ jobTitle: 'Backend Engineer', companyName: 'Acme GmbH', jobLocation: 'Berlin' }),
        ApplicationChannel.direct(),
        Actor.candidate('candidate-1'),
        CorrelationId.create('corr-0'),
      ),
    );
  }

  it('returns the read model for the owning candidate', async () => {
    seedApplication();

    const result = await handler.execute(new GetApplicationQuery(APPLICATION_ID, ActorRole.CANDIDATE, 'candidate-1'));

    expect(result.id).toBe(APPLICATION_ID);
    expect(result.status).toBe('DRAFT');
  });

  it('returns the read model for Admin regardless of ownership', async () => {
    seedApplication();

    const result = await handler.execute(new GetApplicationQuery(APPLICATION_ID, ActorRole.ADMIN, 'admin-1'));

    expect(result.id).toBe(APPLICATION_ID);
  });

  it('throws ForbiddenException for a different candidate', async () => {
    seedApplication();

    await expect(
      handler.execute(new GetApplicationQuery(APPLICATION_ID, ActorRole.CANDIDATE, 'candidate-2')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException for an Employer who does not own the company', async () => {
    seedApplication();
    companyRepository.findById.mockResolvedValue({ ownerId: 'someone-else' } as never);

    await expect(
      handler.execute(new GetApplicationQuery(APPLICATION_ID, ActorRole.COMPANY, 'employer-1')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns the read model for an Employer who owns the company', async () => {
    seedApplication();
    companyRepository.findById.mockResolvedValue({ ownerId: 'employer-1' } as never);

    const result = await handler.execute(new GetApplicationQuery(APPLICATION_ID, ActorRole.COMPANY, 'employer-1'));

    expect(result.id).toBe(APPLICATION_ID);
  });

  it('throws NotFoundException when the application does not exist', async () => {
    applicationRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new GetApplicationQuery(APPLICATION_ID, ActorRole.ADMIN, 'admin-1')),
    ).rejects.toThrow(NotFoundException);
  });
});
