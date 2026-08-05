import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { EmploymentType, ContractType, RemotePolicy } from '@german-job-engine/shared-types';
import { WorkLocationDto } from './work-location.dto';
import { WorkingTimeDto } from './working-time.dto';
import { SalaryRangeDto } from './salary-range.dto';
import { ExperienceRequirementDto } from './experience-requirement.dto';
import { EducationRequirementDto } from './education-requirement.dto';
import { GermanLanguageRequirementDto } from './german-language-requirement.dto';
import { EnglishLanguageRequirementDto } from './english-language-requirement.dto';
import { VisaRequirementDto } from './visa-requirement.dto';
import { AusbildungAvailabilityDto } from './ausbildung-availability.dto';
import { SkillsDto } from './skills.dto';

export class UpdateJobDto {
  @ApiPropertyOptional({ minLength: 3, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ minLength: 10, maxLength: 20000 })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(20000)
  description?: string;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ enum: ContractType })
  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;

  @ApiPropertyOptional({ type: WorkLocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkLocationDto)
  workLocation?: WorkLocationDto;

  @ApiPropertyOptional({ type: WorkingTimeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkingTimeDto)
  workingTime?: WorkingTimeDto;

  @ApiPropertyOptional({ enum: RemotePolicy })
  @IsOptional()
  @IsEnum(RemotePolicy)
  remotePolicy?: RemotePolicy;

  @ApiPropertyOptional({ type: SalaryRangeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SalaryRangeDto)
  salaryRange?: SalaryRangeDto;

  @ApiPropertyOptional({ type: ExperienceRequirementDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExperienceRequirementDto)
  experienceRequirement?: ExperienceRequirementDto;

  @ApiPropertyOptional({ type: EducationRequirementDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EducationRequirementDto)
  educationRequirement?: EducationRequirementDto;

  @ApiPropertyOptional({ type: GermanLanguageRequirementDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GermanLanguageRequirementDto)
  germanLanguageRequirement?: GermanLanguageRequirementDto;

  @ApiPropertyOptional({ type: EnglishLanguageRequirementDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnglishLanguageRequirementDto)
  englishLanguageRequirement?: EnglishLanguageRequirementDto;

  @ApiPropertyOptional({ type: VisaRequirementDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => VisaRequirementDto)
  visaRequirement?: VisaRequirementDto;

  @ApiPropertyOptional({ type: AusbildungAvailabilityDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AusbildungAvailabilityDto)
  ausbildungAvailability?: AusbildungAvailabilityDto;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsISO8601()
  applicationDeadline?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  benefits?: string[];

  @ApiPropertyOptional({ type: SkillsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SkillsDto)
  skills?: SkillsDto;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];
}
