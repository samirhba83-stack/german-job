import {
  EducationLevel,
  EnglishLevel,
  ExperienceLevel,
  GermanLevel,
  SalaryPeriod,
  VisaSponsorship,
} from '@german-job-engine/shared-types';
import { JobUpdate } from '../domain/entities/job.entity';
import { WorkingTime } from '../domain/value-objects/working-time.vo';
import { SalaryRange } from '../domain/value-objects/salary-range.vo';
import { ExperienceRequirement } from '../domain/value-objects/experience-requirement.vo';
import { EducationRequirement } from '../domain/value-objects/education-requirement.vo';
import { GermanLanguageRequirement } from '../domain/value-objects/german-language-requirement.vo';
import { EnglishLanguageRequirement } from '../domain/value-objects/english-language-requirement.vo';
import { VisaRequirement } from '../domain/value-objects/visa-requirement.vo';
import { AusbildungAvailability } from '../domain/value-objects/ausbildung-availability.vo';
import { ApplicationDeadline } from '../domain/value-objects/application-deadline.vo';
import { Benefits } from '../domain/value-objects/benefits.vo';
import { Skills } from '../domain/value-objects/skills.vo';
import { Tags } from '../domain/value-objects/tags.vo';

export interface OptionalJobFieldsInput {
  workingTime?: { hoursPerWeek?: number; isFlexible?: boolean };
  salaryRange?: { min: number; max: number; currency: string; period: SalaryPeriod };
  experienceRequirement?: { minYears: number; level: ExperienceLevel };
  educationRequirement?: { level: EducationLevel; fieldOfStudy?: string; required?: boolean };
  germanLanguageRequirement?: { level: GermanLevel; required: boolean };
  englishLanguageRequirement?: { level: EnglishLevel; required: boolean };
  visaRequirement?: { sponsorshipAvailable: VisaSponsorship; requiresEuWorkAuthorization: boolean };
  ausbildungAvailability?: { isAusbildungPosition: boolean; durationMonths?: number };
  applicationDeadline?: string;
  benefits?: string[];
  skills?: { required?: string[]; niceToHave?: string[] };
  tags?: string[];
}

/**
 * Builds the subset of JobUpdate fields shared by CreateJob and UpdateJob — only the keys
 * present on the input are included, so callers can spread this over required-field handling.
 * Does not catch VO validation errors; callers translate those into the appropriate HTTP response.
 */
export function buildOptionalJobFields(input: OptionalJobFieldsInput): JobUpdate {
  const fields: JobUpdate = {};

  if (input.workingTime !== undefined) {
    fields.workingTime = WorkingTime.create(input.workingTime);
  }
  if (input.salaryRange !== undefined) {
    fields.salaryRange = SalaryRange.create(input.salaryRange);
  }
  if (input.experienceRequirement !== undefined) {
    fields.experienceRequirement = ExperienceRequirement.create(
      input.experienceRequirement.minYears,
      input.experienceRequirement.level,
    );
  }
  if (input.educationRequirement !== undefined) {
    fields.educationRequirement = EducationRequirement.create(input.educationRequirement);
  }
  if (input.germanLanguageRequirement !== undefined) {
    fields.germanLanguageRequirement = GermanLanguageRequirement.create(
      input.germanLanguageRequirement.level,
      input.germanLanguageRequirement.required,
    );
  }
  if (input.englishLanguageRequirement !== undefined) {
    fields.englishLanguageRequirement = EnglishLanguageRequirement.create(
      input.englishLanguageRequirement.level,
      input.englishLanguageRequirement.required,
    );
  }
  if (input.visaRequirement !== undefined) {
    fields.visaRequirement = VisaRequirement.create(
      input.visaRequirement.sponsorshipAvailable,
      input.visaRequirement.requiresEuWorkAuthorization,
    );
  }
  if (input.ausbildungAvailability !== undefined) {
    fields.ausbildungAvailability = AusbildungAvailability.create(input.ausbildungAvailability);
  }
  if (input.applicationDeadline !== undefined) {
    fields.applicationDeadline = ApplicationDeadline.create(new Date(input.applicationDeadline));
  }
  if (input.benefits !== undefined) {
    fields.benefits = Benefits.create(input.benefits);
  }
  if (input.skills !== undefined) {
    fields.skills = Skills.create(input.skills);
  }
  if (input.tags !== undefined) {
    fields.tags = Tags.create(input.tags);
  }

  return fields;
}
