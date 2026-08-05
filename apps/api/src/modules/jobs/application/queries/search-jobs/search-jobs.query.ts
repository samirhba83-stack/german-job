import {
  CompanyIndustry,
  EmploymentType,
  ContractType,
  RemotePolicy,
  VisaSponsorship,
  GermanLevel,
} from '@german-job-engine/shared-types';

export class SearchJobsQuery {
  constructor(
    public readonly keyword?: string,
    public readonly city?: string,
    public readonly companyId?: string,
    public readonly industry?: CompanyIndustry,
    public readonly minSalary?: number,
    public readonly employmentType?: EmploymentType,
    public readonly contractType?: ContractType,
    public readonly remotePolicy?: RemotePolicy,
    public readonly visaSponsorship?: VisaSponsorship,
    public readonly ausbildungOnly?: boolean,
    public readonly germanLevel?: GermanLevel,
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}
