import { ForbiddenException } from '@nestjs/common';
import { ActorRole } from '@german-job-engine/shared-types';
import { SearchApplicationsHandler } from './search-applications.handler';
import { SearchApplicationsQuery } from './search-applications.query';
import { ApplicationRepository } from '../../../domain/repositories/application.repository.interface';
import { CompanyRepository } from '../../../../companies/domain/repositories/company.repository.interface';

describe('SearchApplicationsHandler', () => {
  let applicationRepository: jest.Mocked<ApplicationRepository>;
  let companyRepository: jest.Mocked<CompanyRepository>;
  let handler: SearchApplicationsHandler;

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
    handler = new SearchApplicationsHandler(applicationRepository, companyRepository);
  });

  it('builds a normalized specification and returns a paginated read model for Admin', async () => {
    applicationRepository.search.mockResolvedValue({ items: [], total: 0 });

    const result = await handler.execute(
      new SearchApplicationsQuery(ActorRole.ADMIN, 'admin-1', 'candidate-1', undefined, undefined, undefined, undefined, undefined, undefined, 0, 500),
    );

    expect(applicationRepository.search).toHaveBeenCalledTimes(1);
    const specification = applicationRepository.search.mock.calls[0][0];
    expect(specification.candidateId).toBe('candidate-1');
    expect(specification.page).toBe(1);
    expect(specification.limit).toBe(100);
    expect(result).toEqual({ items: [], total: 0, page: 1, limit: 100 });
  });

  it('forces candidateId to the requester for a Candidate actor, ignoring any candidateId passed in', async () => {
    applicationRepository.search.mockResolvedValue({ items: [], total: 0 });

    await handler.execute(
      new SearchApplicationsQuery(ActorRole.CANDIDATE, 'candidate-1', 'someone-else', undefined, undefined, undefined, undefined, undefined, undefined, undefined),
    );

    const specification = applicationRepository.search.mock.calls[0][0];
    expect(specification.candidateId).toBe('candidate-1');
  });

  it('rejects an Employer search with no companyId', async () => {
    await expect(
      handler.execute(new SearchApplicationsQuery(ActorRole.COMPANY, 'employer-1', undefined, undefined, undefined)),
    ).rejects.toThrow(ForbiddenException);
    expect(applicationRepository.search).not.toHaveBeenCalled();
  });

  it('rejects an Employer search for a company they do not own', async () => {
    companyRepository.findById.mockResolvedValue({ ownerId: 'someone-else' } as never);

    await expect(
      handler.execute(new SearchApplicationsQuery(ActorRole.COMPANY, 'employer-1', undefined, undefined, 'company-1')),
    ).rejects.toThrow(ForbiddenException);
    expect(applicationRepository.search).not.toHaveBeenCalled();
  });

  it('allows an Employer search for a company they own', async () => {
    companyRepository.findById.mockResolvedValue({ ownerId: 'employer-1' } as never);
    applicationRepository.search.mockResolvedValue({ items: [], total: 0 });

    const result = await handler.execute(
      new SearchApplicationsQuery(ActorRole.COMPANY, 'employer-1', undefined, undefined, 'company-1'),
    );

    expect(applicationRepository.search).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ items: [], total: 0, page: 1, limit: 20 });
  });
});
