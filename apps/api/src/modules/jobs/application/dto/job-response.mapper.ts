import { Job } from '../../domain/entities/job.entity';
import { JobResponseDto } from './job-response.dto';

/** Assembles the read-facing DTO from the domain aggregate — shared by every handler that returns a job. */
export class JobResponseMapper {
  static toDto(job: Job): JobResponseDto {
    const dto = new JobResponseDto();
    dto.id = job.id;
    dto.companyId = job.companyId;
    dto.title = job.title.value;
    dto.description = job.description.value;
    dto.status = job.status;
    dto.employmentType = job.employmentType;
    dto.contractType = job.contractType;

    dto.workingTime = job.workingTime
      ? { hoursPerWeek: job.workingTime.hoursPerWeek, isFlexible: job.workingTime.isFlexible }
      : null;

    dto.workLocation = {
      city: job.workLocation.city,
      country: job.workLocation.country,
      postalCode: job.workLocation.postalCode,
      street: job.workLocation.street,
    };

    dto.remotePolicy = job.remotePolicy;

    dto.salaryRange = job.salaryRange
      ? {
          min: job.salaryRange.min,
          max: job.salaryRange.max,
          currency: job.salaryRange.currency.code,
          period: job.salaryRange.period,
        }
      : null;

    dto.experienceRequirement = job.experienceRequirement
      ? { minYears: job.experienceRequirement.minYears, level: job.experienceRequirement.level }
      : null;

    dto.educationRequirement = job.educationRequirement
      ? {
          level: job.educationRequirement.level,
          fieldOfStudy: job.educationRequirement.fieldOfStudy,
          required: job.educationRequirement.required,
        }
      : null;

    dto.germanLanguageRequirement = job.germanLanguageRequirement
      ? { level: job.germanLanguageRequirement.level, required: job.germanLanguageRequirement.required }
      : null;

    dto.englishLanguageRequirement = job.englishLanguageRequirement
      ? { level: job.englishLanguageRequirement.level, required: job.englishLanguageRequirement.required }
      : null;

    dto.visaRequirement = job.visaRequirement
      ? {
          sponsorshipAvailable: job.visaRequirement.sponsorshipAvailable,
          requiresEuWorkAuthorization: job.visaRequirement.requiresEuWorkAuthorization,
        }
      : null;

    dto.ausbildungAvailability = job.ausbildungAvailability
      ? {
          isAusbildungPosition: job.ausbildungAvailability.isAusbildungPosition,
          durationMonths: job.ausbildungAvailability.durationMonths,
        }
      : null;

    dto.applicationDeadline = job.applicationDeadline?.value ?? null;
    dto.benefits = [...job.benefits.items];
    dto.skills = { required: [...job.skills.required], niceToHave: [...job.skills.niceToHave] };
    dto.tags = [...job.tags.items];
    dto.createdAt = job.createdAt;
    dto.updatedAt = job.updatedAt;

    return dto;
  }
}
