import {
  CompanyStatus,
  CompanyIndustry,
  CompanySize,
  VisaSponsorship,
  AusbildungSupport,
} from '../enums';

export interface CompanyLocationDto {
  city: string;
  country: string;
  postalCode: string | null;
  street: string | null;
}

export interface CompanyContactDto {
  contactName: string | null;
  contactEmail: string;
  contactPhone: string | null;
}

export interface HiringQualityDto {
  score: number;
  computedAt: string;
}

export interface TrustScoreDto {
  score: number;
  computedAt: string;
}

export interface CompanyMetadataDto {
  description: string | null;
  logoUrl: string | null;
  foundedYear: number | null;
  tags: string[];
}

export interface CompanyDto {
  id: string;
  ownerId: string;
  name: string;
  status: CompanyStatus;
  industry: CompanyIndustry;
  size: CompanySize;
  location: CompanyLocationDto;
  websiteUrl: string | null;
  contact: CompanyContactDto;
  visaSponsorship: VisaSponsorship;
  ausbildungSupport: AusbildungSupport;
  /** Real DTO field. No production code path sets this — `Company` has no
   * `recordHiringQuality()`-equivalent method at all (docs/company-workspace/03-integration-
   * points.md). Always `null` in practice; never assume otherwise. */
  hiringQuality: HiringQualityDto | null;
  /** Same status as `hiringQuality` — always `null` in practice today. */
  trustScore: TrustScoreDto | null;
  metadata: CompanyMetadataDto;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedCompaniesDto {
  items: CompanyDto[];
  total: number;
  page: number;
  limit: number;
}
