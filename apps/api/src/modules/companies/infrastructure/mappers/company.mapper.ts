import { Company as PrismaCompany } from '@german-job-engine/database';
import {
  CompanyStatus,
  CompanyIndustry,
  CompanySize,
  VisaSponsorship,
  AusbildungSupport,
} from '@german-job-engine/shared-types';
import { Company, CompanyProps } from '../../domain/entities/company.entity';
import { CompanyLocation } from '../../domain/value-objects/company-location.vo';
import { CompanyWebsite } from '../../domain/value-objects/company-website.vo';
import { CompanyContact } from '../../domain/value-objects/company-contact.vo';
import { HiringQuality } from '../../domain/value-objects/hiring-quality.vo';
import { TrustScore } from '../../domain/value-objects/trust-score.vo';
import { CompanyMetadata } from '../../domain/value-objects/company-metadata.vo';

export interface CompanyPersistenceScalars {
  ownerId: string;
  name: string;
  status: PrismaCompany['status'];
  industry: PrismaCompany['industry'];
  size: PrismaCompany['size'];
  city: string;
  country: string;
  postalCode: string | null;
  street: string | null;
  federalState: string | null;
  latitude: number | null;
  longitude: number | null;
  websiteUrl: string | null;
  contactName: string | null;
  contactEmail: string;
  contactPhone: string | null;
  visaSponsorship: PrismaCompany['visaSponsorship'];
  ausbildungSupport: PrismaCompany['ausbildungSupport'];
  hiringQualityScore: number | null;
  hiringQualityComputedAt: Date | null;
  trustScoreValue: number | null;
  trustScoreComputedAt: Date | null;
  description: string | null;
  logoUrl: string | null;
  foundedYear: number | null;
  tags: string[];
}

export class CompanyMapper {
  static toDomain(raw: PrismaCompany): Company {
    const props: CompanyProps = {
      ownerId: raw.ownerId,
      name: raw.name,
      status: raw.status as unknown as CompanyStatus,
      industry: raw.industry as unknown as CompanyIndustry,
      size: raw.size as unknown as CompanySize,
      location: CompanyLocation.create({
        city: raw.city,
        country: raw.country,
        postalCode: raw.postalCode,
        street: raw.street,
        federalState: raw.federalState,
        latitude: raw.latitude,
        longitude: raw.longitude,
      }),
      website: raw.websiteUrl ? CompanyWebsite.create(raw.websiteUrl) : null,
      contact: CompanyContact.create({
        contactName: raw.contactName,
        contactEmail: raw.contactEmail,
        contactPhone: raw.contactPhone,
      }),
      visaSponsorship: raw.visaSponsorship as unknown as VisaSponsorship,
      ausbildungSupport: raw.ausbildungSupport as unknown as AusbildungSupport,
      hiringQuality:
        raw.hiringQualityScore !== null && raw.hiringQualityComputedAt !== null
          ? HiringQuality.create(raw.hiringQualityScore, raw.hiringQualityComputedAt)
          : null,
      trustScore:
        raw.trustScoreValue !== null && raw.trustScoreComputedAt !== null
          ? TrustScore.create(raw.trustScoreValue, raw.trustScoreComputedAt)
          : null,
      metadata: CompanyMetadata.create({
        description: raw.description,
        logoUrl: raw.logoUrl,
        foundedYear: raw.foundedYear,
        tags: raw.tags,
      }),
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };

    return Company.reconstitute(raw.id, props);
  }

  static toPersistence(company: Company): CompanyPersistenceScalars {
    return {
      ownerId: company.ownerId,
      name: company.name,
      status: company.status as unknown as PrismaCompany['status'],
      industry: company.industry as unknown as PrismaCompany['industry'],
      size: company.size as unknown as PrismaCompany['size'],
      city: company.location.city,
      country: company.location.country,
      postalCode: company.location.postalCode,
      street: company.location.street,
      federalState: company.location.federalState,
      latitude: company.location.latitude,
      longitude: company.location.longitude,
      websiteUrl: company.website?.value ?? null,
      contactName: company.contact.contactName,
      contactEmail: company.contact.contactEmail,
      contactPhone: company.contact.contactPhone,
      visaSponsorship: company.visaSponsorship as unknown as PrismaCompany['visaSponsorship'],
      ausbildungSupport: company.ausbildungSupport as unknown as PrismaCompany['ausbildungSupport'],
      hiringQualityScore: company.hiringQuality?.score ?? null,
      hiringQualityComputedAt: company.hiringQuality?.computedAt ?? null,
      trustScoreValue: company.trustScore?.score ?? null,
      trustScoreComputedAt: company.trustScore?.computedAt ?? null,
      description: company.metadata.description,
      logoUrl: company.metadata.logoUrl,
      foundedYear: company.metadata.foundedYear,
      tags: [...company.metadata.tags],
    };
  }
}
