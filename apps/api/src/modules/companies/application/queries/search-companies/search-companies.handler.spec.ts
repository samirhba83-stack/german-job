import { CompanyIndustry } from '@german-job-engine/shared-types';
import { SearchCompaniesHandler } from './search-companies.handler';
import { SearchCompaniesQuery } from './search-companies.query';
import { CompanyRepository } from '../../../domain/repositories/company.repository.interface';

describe('SearchCompaniesHandler', () => {
  let companyRepository: jest.Mocked<CompanyRepository>;
  let handler: SearchCompaniesHandler;

  beforeEach(() => {
    companyRepository = {
      findById: jest.fn(),
      findByOwnerId: jest.fn(),
      search: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      save: jest.fn(),
      delete: jest.fn(),
    };
    handler = new SearchCompaniesHandler(companyRepository);
  });

  it('builds a specification from the query and delegates to the repository', async () => {
    const result = await handler.execute(
      new SearchCompaniesQuery('acme', CompanyIndustry.IT_SOFTWARE, undefined, 'Berlin', undefined, 2, 10),
    );

    expect(companyRepository.search).toHaveBeenCalledTimes(1);
    const specArg = companyRepository.search.mock.calls[0][0];
    expect(specArg.keyword).toBe('acme');
    expect(specArg.industry).toBe(CompanyIndustry.IT_SOFTWARE);
    expect(specArg.city).toBe('Berlin');
    expect(specArg.page).toBe(2);
    expect(specArg.limit).toBe(10);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.items).toEqual([]);
  });
});
