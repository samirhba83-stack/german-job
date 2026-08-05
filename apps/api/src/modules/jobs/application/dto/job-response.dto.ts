import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
} from '@german-job-engine/shared-types';

export class WorkLocationResponseDto {
  @ApiProperty() city!: string;
  @ApiProperty() country!: string;
  @ApiPropertyOptional({ nullable: true }) postalCode!: string | null;
  @ApiPropertyOptional({ nullable: true }) street!: string | null;
}

export class WorkingTimeResponseDto {
  @ApiPropertyOptional({ nullable: true }) hoursPerWeek!: number | null;
  @ApiProperty() isFlexible!: boolean;
}

export class SalaryRangeResponseDto {
  @ApiProperty() min!: number;
  @ApiProperty() max!: number;
  @ApiProperty({ enum: Currency }) currency!: Currency;
  @ApiProperty({ enum: SalaryPeriod }) period!: SalaryPeriod;
}

export class ExperienceRequirementResponseDto {
  @ApiProperty() minYears!: number;
  @ApiProperty({ enum: ExperienceLevel }) level!: ExperienceLevel;
}

export class EducationRequirementResponseDto {
  @ApiProperty({ enum: EducationLevel }) level!: EducationLevel;
  @ApiPropertyOptional({ nullable: true }) fieldOfStudy!: string | null;
  @ApiProperty() required!: boolean;
}

export class GermanLanguageRequirementResponseDto {
  @ApiProperty({ enum: GermanLevel }) level!: GermanLevel;
  @ApiProperty() required!: boolean;
}

export class EnglishLanguageRequirementResponseDto {
  @ApiProperty({ enum: EnglishLevel }) level!: EnglishLevel;
  @ApiProperty() required!: boolean;
}

export class VisaRequirementResponseDto {
  @ApiProperty({ enum: VisaSponsorship }) sponsorshipAvailable!: VisaSponsorship;
  @ApiProperty() requiresEuWorkAuthorization!: boolean;
}

export class AusbildungAvailabilityResponseDto {
  @ApiProperty() isAusbildungPosition!: boolean;
  @ApiPropertyOptional({ nullable: true }) durationMonths!: number | null;
}

export class JobSkillsResponseDto {
  @ApiProperty({ type: [String] }) required!: string[];
  @ApiProperty({ type: [String] }) niceToHave!: string[];
}

export class JobResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: JobStatus }) status!: JobStatus;
  @ApiProperty({ enum: EmploymentType }) employmentType!: EmploymentType;
  @ApiProperty({ enum: ContractType }) contractType!: ContractType;
  @ApiPropertyOptional({ type: WorkingTimeResponseDto, nullable: true }) workingTime!: WorkingTimeResponseDto | null;
  @ApiProperty({ type: WorkLocationResponseDto }) workLocation!: WorkLocationResponseDto;
  @ApiProperty({ enum: RemotePolicy }) remotePolicy!: RemotePolicy;
  @ApiPropertyOptional({ type: SalaryRangeResponseDto, nullable: true }) salaryRange!: SalaryRangeResponseDto | null;
  @ApiPropertyOptional({ type: ExperienceRequirementResponseDto, nullable: true })
  experienceRequirement!: ExperienceRequirementResponseDto | null;
  @ApiPropertyOptional({ type: EducationRequirementResponseDto, nullable: true })
  educationRequirement!: EducationRequirementResponseDto | null;
  @ApiPropertyOptional({ type: GermanLanguageRequirementResponseDto, nullable: true })
  germanLanguageRequirement!: GermanLanguageRequirementResponseDto | null;
  @ApiPropertyOptional({ type: EnglishLanguageRequirementResponseDto, nullable: true })
  englishLanguageRequirement!: EnglishLanguageRequirementResponseDto | null;
  @ApiPropertyOptional({ type: VisaRequirementResponseDto, nullable: true })
  visaRequirement!: VisaRequirementResponseDto | null;
  @ApiPropertyOptional({ type: AusbildungAvailabilityResponseDto, nullable: true })
  ausbildungAvailability!: AusbildungAvailabilityResponseDto | null;
  @ApiPropertyOptional({ nullable: true }) applicationDeadline!: Date | null;
  @ApiProperty({ type: [String] }) benefits!: string[];
  @ApiProperty({ type: JobSkillsResponseDto }) skills!: JobSkillsResponseDto;
  @ApiProperty({ type: [String] }) tags!: string[];
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
