import { CompanyIndustry, CompanySize, VisaSponsorship } from '@german-job-engine/shared-types';

export class SearchCompaniesQuery {
  constructor(
    public readonly keyword?: string,
    public readonly industry?: CompanyIndustry,
    public readonly size?: CompanySize,
    public readonly city?: string,
    public readonly visaSponsorship?: VisaSponsorship,
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}
