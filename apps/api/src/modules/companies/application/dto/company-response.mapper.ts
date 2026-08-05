import { Company } from '../../domain/entities/company.entity';
import { CompanyResponseDto } from './company-response.dto';

/** Assembles the read-facing DTO from the domain aggregate — shared by every handler that returns a company. */
export class CompanyResponseMapper {
  static toDto(company: Company): CompanyResponseDto {
    const dto = new CompanyResponseDto();
    dto.id = company.id;
    dto.ownerId = company.ownerId;
    dto.name = company.name;
    dto.status = company.status;
    dto.industry = company.industry;
    dto.size = company.size;

    dto.location = {
      city: company.location.city,
      country: company.location.country,
      postalCode: company.location.postalCode,
      street: company.location.street,
    };

    dto.websiteUrl = company.website?.value ?? null;

    dto.contact = {
      contactName: company.contact.contactName,
      contactEmail: company.contact.contactEmail,
      contactPhone: company.contact.contactPhone,
    };

    dto.visaSponsorship = company.visaSponsorship;
    dto.ausbildungSupport = company.ausbildungSupport;

    dto.hiringQuality = company.hiringQuality
      ? { score: company.hiringQuality.score, computedAt: company.hiringQuality.computedAt }
      : null;

    dto.trustScore = company.trustScore
      ? { score: company.trustScore.score, computedAt: company.trustScore.computedAt }
      : null;

    dto.metadata = {
      description: company.metadata.description,
      logoUrl: company.metadata.logoUrl,
      foundedYear: company.metadata.foundedYear,
      tags: [...company.metadata.tags],
    };

    dto.createdAt = company.createdAt;
    dto.updatedAt = company.updatedAt;

    return dto;
  }
}
