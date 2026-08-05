import { UserRole, CompanyIndustry, CompanySize, VisaSponsorship, AusbildungSupport } from '@german-job-engine/shared-types';
import { CreateCompanyLocation, CreateCompanyContact, CreateCompanyMetadata } from '../create-company/create-company.command';

export class UpdateCompanyCommand {
  constructor(
    public readonly companyId: string,
    public readonly requesterId: string,
    public readonly requesterRole: UserRole,
    public readonly changes: {
      name?: string;
      industry?: CompanyIndustry;
      size?: CompanySize;
      location?: CreateCompanyLocation;
      websiteUrl?: string;
      contact?: CreateCompanyContact;
      visaSponsorship?: VisaSponsorship;
      ausbildungSupport?: AusbildungSupport;
      metadata?: CreateCompanyMetadata;
    },
  ) {}
}
