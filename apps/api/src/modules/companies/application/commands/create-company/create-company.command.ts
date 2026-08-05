import { CompanyIndustry, CompanySize, VisaSponsorship, AusbildungSupport } from '@german-job-engine/shared-types';

export interface CreateCompanyLocation {
  city: string;
  country: string;
  postalCode?: string;
  street?: string;
}

export interface CreateCompanyContact {
  contactName?: string;
  contactEmail: string;
  contactPhone?: string;
}

export interface CreateCompanyMetadata {
  description?: string;
  logoUrl?: string;
  foundedYear?: number;
  tags?: string[];
}

export class CreateCompanyCommand {
  constructor(
    public readonly ownerId: string,
    public readonly data: {
      name: string;
      industry: CompanyIndustry;
      size: CompanySize;
      location: CreateCompanyLocation;
      websiteUrl?: string;
      contact: CreateCompanyContact;
      visaSponsorship?: VisaSponsorship;
      ausbildungSupport?: AusbildungSupport;
      metadata?: CreateCompanyMetadata;
    },
  ) {}
}
