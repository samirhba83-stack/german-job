import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { GermanLevel } from '@german-job-engine/shared-types';
import { SalaryExpectationDto } from './salary-expectation.dto';
import { AvailabilityDto } from './availability.dto';
import { WorkExperienceDto } from './work-experience.dto';
import { EducationDto } from './education.dto';
import { LanguageDto } from './language.dto';

export class UpdateProfileDto {
  @IsOptional()
  @IsEnum(GermanLevel)
  germanLevel?: GermanLevel;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  skills?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  preferredCities?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SalaryExpectationDto)
  salaryExpectation?: SalaryExpectationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AvailabilityDto)
  availability?: AvailabilityDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => WorkExperienceDto)
  workExperiences?: WorkExperienceDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  educations?: EducationDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => LanguageDto)
  languages?: LanguageDto[];
}
