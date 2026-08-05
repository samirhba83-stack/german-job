import { ListCompaniesHandler } from './list-companies.handler';
import { ListCompaniesQuery } from './list-companies.query';
import { CompanyRepository } from '../../../domain/repositories/company.repository.interface';

describe('ListCompaniesHandler', () => {
  let companyRepository: jest.Mocked<CompanyRepository>;
  let handler: ListCompaniesHandler;

  beforeEach(() => {
    companyRepository = {
      findById: jest.fn(),
      findByOwnerId: jest.fn(),
      search: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      save: jest.fn(),
      delete: jest.fn(),
    };
    handler = new ListCompaniesHandler(companyRepository);
  });

  it('delegates to the repository with no filters applied', async () => {
    const result = await handler.execute(new ListCompaniesQuery(1, 20));

    expect(companyRepository.search).toHaveBeenCalledTimes(1);
    const specArg = companyRepository.search.mock.calls[0][0];
    expect(specArg.keyword).toBeNull();
    expect(specArg.industry).toBeNull();
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });
});
