import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import {
  CompanyIndustry,
  EmploymentType,
  ContractType,
  RemotePolicy,
  VisaSponsorship,
  GermanLevel,
} from '@german-job-engine/shared-types';

export class SearchJobsQueryDto {
  @ApiPropertyOptional({ description: 'Free-text match against job title' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  keyword?: string;

  @ApiPropertyOptional({ example: 'Berlin' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ enum: CompanyIndustry })
  @IsOptional()
  @IsEnum(CompanyIndustry)
  industry?: CompanyIndustry;

  @ApiPropertyOptional({ description: 'Minimum salary the job must be able to reach' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minSalary?: number;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ enum: ContractType })
  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;

  @ApiPropertyOptional({ enum: RemotePolicy })
  @IsOptional()
  @IsEnum(RemotePolicy)
  remotePolicy?: RemotePolicy;

  @ApiPropertyOptional({ enum: VisaSponsorship })
  @IsOptional()
  @IsEnum(VisaSponsorship)
  visaSponsorship?: VisaSponsorship;

  @ApiPropertyOptional({ description: 'Only return Ausbildung positions' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  ausbildungOnly?: boolean;

  @ApiPropertyOptional({ enum: GermanLevel })
  @IsOptional()
  @IsEnum(GermanLevel)
  germanLevel?: GermanLevel;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
