import { GermanLevel, LanguageProficiency, AvailabilityStatus } from '../enums';

export interface SalaryExpectationDto {
  min: number;
  max: number;
  currency: string;
}

export interface AvailabilityDto {
  status: AvailabilityStatus;
  availableFrom: string | null;
}

export interface FileMetadataDto {
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface WorkExperienceDto {
  company: string;
  title: string;
  startDate: string;
  endDate: string | null;
  description: string | null;
}

export interface EducationDto {
  institution: string;
  degree: string;
  fieldOfStudy: string | null;
  startDate: string;
  endDate: string | null;
}

export interface LanguageEntryDto {
  language: string;
  proficiency: LanguageProficiency;
}

export interface ProfileDto {
  id: string;
  userId: string;
  germanLevel: GermanLevel | null;
  skills: string[];
  preferredCities: string[];
  salaryExpectation: SalaryExpectationDto | null;
  availability: AvailabilityDto | null;
  cv: FileMetadataDto | null;
  photo: FileMetadataDto | null;
  workExperiences: WorkExperienceDto[];
  educations: EducationDto[];
  languages: LanguageEntryDto[];
  completionPercentage: number;
  createdAt: string;
  updatedAt: string;
}
