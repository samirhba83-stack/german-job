import { JobListing as PrismaJobListing } from '@german-job-engine/database';
import {
  JobStatus,
  EmploymentType,
  ContractType,
  RemotePolicy,
  ExperienceLevel,
  EducationLevel,
  GermanLevel,
  EnglishLevel,
  VisaSponsorship,
} from '@german-job-engine/shared-types';
import { Job, JobProps } from '../../domain/entities/job.entity';
import { JobTitle } from '../../domain/value-objects/job-title.vo';
import { JobDescription } from '../../domain/value-objects/job-description.vo';
import { WorkingTime } from '../../domain/value-objects/working-time.vo';
import { WorkLocation } from '../../domain/value-objects/work-location.vo';
import { SalaryRange } from '../../domain/value-objects/salary-range.vo';
import { ExperienceRequirement } from '../../domain/value-objects/experience-requirement.vo';
import { EducationRequirement } from '../../domain/value-objects/education-requirement.vo';
import { GermanLanguageRequirement } from '../../domain/value-objects/german-language-requirement.vo';
import { EnglishLanguageRequirement } from '../../domain/value-objects/english-language-requirement.vo';
import { VisaRequirement } from '../../domain/value-objects/visa-requirement.vo';
import { AusbildungAvailability } from '../../domain/value-objects/ausbildung-availability.vo';
import { ApplicationDeadline } from '../../domain/value-objects/application-deadline.vo';
import { Benefits } from '../../domain/value-objects/benefits.vo';
import { Skills } from '../../domain/value-objects/skills.vo';
import { Tags } from '../../domain/value-objects/tags.vo';

export interface JobPersistenceScalars {
  companyId: string;
  title: string;
  description: string;
  status: PrismaJobListing['status'];
  employmentType: PrismaJobListing['employmentType'];
  contractType: PrismaJobListing['contractType'];
  workingTimeHoursPerWeek: number | null;
  workingTimeIsFlexible: boolean;
  city: string;
  country: string;
  postalCode: string | null;
  street: string | null;
  remotePolicy: PrismaJobListing['remotePolicy'];
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: PrismaJobListing['salaryCurrency'];
  salaryPeriod: PrismaJobListing['salaryPeriod'];
  experienceMinYears: number | null;
  experienceLevel: PrismaJobListing['experienceLevel'];
  educationLevel: PrismaJobListing['educationLevel'];
  educationFieldOfStudy: string | null;
  educationRequired: boolean | null;
  germanLevelRequired: PrismaJobListing['germanLevelRequired'];
  germanRequired: boolean | null;
  englishLevelRequired: PrismaJobListing['englishLevelRequired'];
  englishRequired: boolean | null;
  visaSponsorshipAvailable: PrismaJobListing['visaSponsorshipAvailable'];
  requiresEuWorkAuthorization: boolean | null;
  isAusbildungPosition: boolean;
  ausbildungDurationMonths: number | null;
  applicationDeadline: Date | null;
  benefits: string[];
  requiredSkills: string[];
  niceToHaveSkills: string[];
  tags: string[];
}

export class JobMapper {
  static toDomain(raw: PrismaJobListing): Job {
    const props: JobProps = {
      companyId: raw.companyId,
      title: JobTitle.create(raw.title),
      description: JobDescription.create(raw.description),
      status: raw.status as unknown as JobStatus,
      employmentType: raw.employmentType as unknown as EmploymentType,
      contractType: raw.contractType as unknown as ContractType,
      workingTime:
        raw.workingTimeHoursPerWeek !== null || raw.workingTimeIsFlexible
          ? WorkingTime.create({
              hoursPerWeek: raw.workingTimeHoursPerWeek,
              isFlexible: raw.workingTimeIsFlexible,
            })
          : null,
      workLocation: WorkLocation.create({
        city: raw.city,
        country: raw.country,
        postalCode: raw.postalCode,
        street: raw.street,
      }),
      remotePolicy: raw.remotePolicy as unknown as RemotePolicy,
      salaryRange:
        raw.salaryMin !== null && raw.salaryMax !== null && raw.salaryCurrency !== null && raw.salaryPeriod !== null
          ? SalaryRange.create({
              min: raw.salaryMin,
              max: raw.salaryMax,
              currency: raw.salaryCurrency,
              period: raw.salaryPeriod as unknown as never,
            })
          : null,
      experienceRequirement:
        raw.experienceMinYears !== null && raw.experienceLevel !== null
          ? ExperienceRequirement.create(raw.experienceMinYears, raw.experienceLevel as unknown as ExperienceLevel)
          : null,
      educationRequirement: raw.educationLevel
        ? EducationRequirement.create({
            level: raw.educationLevel as unknown as EducationLevel,
            fieldOfStudy: raw.educationFieldOfStudy,
            required: raw.educationRequired ?? false,
          })
        : null,
      germanLanguageRequirement: raw.germanLevelRequired
        ? GermanLanguageRequirement.create(raw.germanLevelRequired as unknown as GermanLevel, raw.germanRequired ?? false)
        : null,
      englishLanguageRequirement: raw.englishLevelRequired
        ? EnglishLanguageRequirement.create(raw.englishLevelRequired as unknown as EnglishLevel, raw.englishRequired ?? false)
        : null,
      visaRequirement: raw.visaSponsorshipAvailable
        ? VisaRequirement.create(
            raw.visaSponsorshipAvailable as unknown as VisaSponsorship,
            raw.requiresEuWorkAuthorization ?? false,
          )
        : null,
      ausbildungAvailability: AusbildungAvailability.create({
        isAusbildungPosition: raw.isAusbildungPosition,
        durationMonths: raw.ausbildungDurationMonths,
      }),
      applicationDeadline: raw.applicationDeadline ? ApplicationDeadline.create(raw.applicationDeadline) : null,
      benefits: Benefits.create(raw.benefits),
      skills: Skills.create({ required: raw.requiredSkills, niceToHave: raw.niceToHaveSkills }),
      tags: Tags.create(raw.tags),
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };

    return Job.reconstitute(raw.id, props);
  }

  static toPersistence(job: Job): JobPersistenceScalars {
    return {
      companyId: job.companyId,
      title: job.title.value,
      description: job.description.value,
      status: job.status as unknown as PrismaJobListing['status'],
      employmentType: job.employmentType as unknown as PrismaJobListing['employmentType'],
      contractType: job.contractType as unknown as PrismaJobListing['contractType'],
      workingTimeHoursPerWeek: job.workingTime?.hoursPerWeek ?? null,
      workingTimeIsFlexible: job.workingTime?.isFlexible ?? false,
      city: job.workLocation.city,
      country: job.workLocation.country,
      postalCode: job.workLocation.postalCode,
      street: job.workLocation.street,
      remotePolicy: job.remotePolicy as unknown as PrismaJobListing['remotePolicy'],
      salaryMin: job.salaryRange?.min ?? null,
      salaryMax: job.salaryRange?.max ?? null,
      salaryCurrency: (job.salaryRange?.currency.code ?? null) as unknown as PrismaJobListing['salaryCurrency'],
      salaryPeriod: (job.salaryRange?.period ?? null) as unknown as PrismaJobListing['salaryPeriod'],
      experienceMinYears: job.experienceRequirement?.minYears ?? null,
      experienceLevel: (job.experienceRequirement?.level ?? null) as unknown as PrismaJobListing['experienceLevel'],
      educationLevel: (job.educationRequirement?.level ?? null) as unknown as PrismaJobListing['educationLevel'],
      educationFieldOfStudy: job.educationRequirement?.fieldOfStudy ?? null,
      educationRequired: job.educationRequirement?.required ?? null,
      germanLevelRequired: (job.germanLanguageRequirement?.level ?? null) as unknown as PrismaJobListing['germanLevelRequired'],
      germanRequired: job.germanLanguageRequirement?.required ?? null,
      englishLevelRequired: (job.englishLanguageRequirement?.level ?? null) as unknown as PrismaJobListing['englishLevelRequired'],
      englishRequired: job.englishLanguageRequirement?.required ?? null,
      visaSponsorshipAvailable: (job.visaRequirement?.sponsorshipAvailable ??
        null) as unknown as PrismaJobListing['visaSponsorshipAvailable'],
      requiresEuWorkAuthorization: job.visaRequirement?.requiresEuWorkAuthorization ?? null,
      isAusbildungPosition: job.ausbildungAvailability?.isAusbildungPosition ?? false,
      ausbildungDurationMonths: job.ausbildungAvailability?.durationMonths ?? null,
      applicationDeadline: job.applicationDeadline?.value ?? null,
      benefits: [...job.benefits.items],
      requiredSkills: [...job.skills.required],
      niceToHaveSkills: [...job.skills.niceToHave],
      tags: [...job.tags.items],
    };
  }
}
