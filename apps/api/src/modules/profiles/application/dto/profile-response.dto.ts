import { AvailabilityStatus, GermanLevel, LanguageProficiency } from '@german-job-engine/shared-types';

export class SalaryExpectationResponseDto {
  min!: number;
  max!: number;
  currency!: string;
}

export class AvailabilityResponseDto {
  status!: AvailabilityStatus;
  availableFrom!: Date | null;
}

export class FileMetadataResponseDto {
  fileName!: string;
  fileUrl!: string;
  mimeType!: string;
  sizeBytes!: number;
  uploadedAt!: Date;
}

export class WorkExperienceResponseDto {
  company!: string;
  title!: string;
  startDate!: Date;
  endDate!: Date | null;
  description!: string | null;
}

export class EducationResponseDto {
  institution!: string;
  degree!: string;
  fieldOfStudy!: string | null;
  startDate!: Date;
  endDate!: Date | null;
}

export class LanguageResponseDto {
  language!: string;
  proficiency!: LanguageProficiency;
}

export class ProfileResponseDto {
  id!: string;
  userId!: string;
  germanLevel!: GermanLevel | null;
  skills!: string[];
  preferredCities!: string[];
  salaryExpectation!: SalaryExpectationResponseDto | null;
  availability!: AvailabilityResponseDto | null;
  cv!: FileMetadataResponseDto | null;
  photo!: FileMetadataResponseDto | null;
  workExperiences!: WorkExperienceResponseDto[];
  educations!: EducationResponseDto[];
  languages!: LanguageResponseDto[];
  completionPercentage!: number;
  createdAt!: Date;
  updatedAt!: Date;
}
