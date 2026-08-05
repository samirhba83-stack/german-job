import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CompanyIndustry, CompanySize, VisaSponsorship } from '@german-job-engine/shared-types';

export class SearchCompaniesQueryDto {
  @ApiPropertyOptional({ description: 'Free-text match against company name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  keyword?: string;

  @ApiPropertyOptional({ enum: CompanyIndustry })
  @IsOptional()
  @IsEnum(CompanyIndustry)
  industry?: CompanyIndustry;

  @ApiPropertyOptional({ enum: CompanySize })
  @IsOptional()
  @IsEnum(CompanySize)
  size?: CompanySize;

  @ApiPropertyOptional({ example: 'Berlin' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ enum: VisaSponsorship })
  @IsOptional()
  @IsEnum(VisaSponsorship)
  visaSponsorship?: VisaSponsorship;

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
