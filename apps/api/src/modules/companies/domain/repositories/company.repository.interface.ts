import { Repository } from '../../../../shared/application';
import { Company } from '../entities/company.entity';
import { CompanySearchSpecification } from '../specifications/company-search.specification';

export const COMPANY_REPOSITORY = Symbol('COMPANY_REPOSITORY');

export interface CompanySearchResult {
  items: Company[];
  total: number;
}

export interface CompanyRepository extends Repository<Company, string> {
  findByOwnerId(ownerId: string): Promise<Company | null>;
  search(specification: CompanySearchSpecification): Promise<CompanySearchResult>;
}
