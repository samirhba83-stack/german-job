import {
  JobStatus,
  EmploymentType,
  ContractType,
  RemotePolicy,
  Currency,
  SalaryPeriod,
  ExperienceLevel,
  EducationLevel,
  GermanLevel,
  EnglishLevel,
  VisaSponsorship,
} from '../enums';

export interface WorkLocationDto {
  city: string;
  country: string;
  postalCode: string | null;
  street: string | null;
}

export interface WorkingTimeDto {
  hoursPerWeek: number | null;
  isFlexible: boolean;
}

export interface SalaryRangeDto {
  min: number;
  max: number;
  currency: Currency;
  period: SalaryPeriod;
}

export interface ExperienceRequirementDto {
  minYears: number;
  level: ExperienceLevel;
}

export interface EducationRequirementDto {
  level: EducationLevel;
  fieldOfStudy: string | null;
  required: boolean;
}

export interface GermanLanguageRequirementDto {
  level: GermanLevel;
  required: boolean;
}

export interface EnglishLanguageRequirementDto {
  level: EnglishLevel;
  required: boolean;
}

export interface VisaRequirementDto {
  sponsorshipAvailable: VisaSponsorship;
  requiresEuWorkAuthorization: boolean;
}

export interface AusbildungAvailabilityDto {
  isAusbildungPosition: boolean;
  durationMonths: number | null;
}

export interface JobSkillsDto {
  required: string[];
  niceToHave: string[];
}

export interface JobDto {
  id: string;
  companyId: string;
  title: string;
  description: string;
  status: JobStatus;
  employmentType: EmploymentType;
  contractType: ContractType;
  workingTime: WorkingTimeDto | null;
  workLocation: WorkLocationDto;
  remotePolicy: RemotePolicy;
  salaryRange: SalaryRangeDto | null;
  experienceRequirement: ExperienceRequirementDto | null;
  educationRequirement: EducationRequirementDto | null;
  germanLanguageRequirement: GermanLanguageRequirementDto | null;
  englishLanguageRequirement: EnglishLanguageRequirementDto | null;
  visaRequirement: VisaRequirementDto | null;
  ausbildungAvailability: AusbildungAvailabilityDto | null;
  applicationDeadline: string | null;
  benefits: string[];
  skills: JobSkillsDto;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
