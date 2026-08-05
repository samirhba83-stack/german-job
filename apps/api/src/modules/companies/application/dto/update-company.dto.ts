import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import { CompanyIndustry, CompanySize, VisaSponsorship, AusbildungSupport } from '@german-job-engine/shared-types';
import { LocationDto } from './location.dto';
import { ContactDto } from './contact.dto';
import { MetadataDto } from './metadata.dto';

export class UpdateCompanyDto {
  @ApiPropertyOptional({ example: 'Acme GmbH', maxLength: 200 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: CompanyIndustry })
  @IsOptional()
  @IsEnum(CompanyIndustry)
  industry?: CompanyIndustry;

  @ApiPropertyOptional({ enum: CompanySize })
  @IsOptional()
  @IsEnum(CompanySize)
  size?: CompanySize;

  @ApiPropertyOptional({ type: LocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @ApiPropertyOptional({ example: 'https://acme.de' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  websiteUrl?: string;

  @ApiPropertyOptional({ type: ContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDto)
  contact?: ContactDto;

  @ApiPropertyOptional({ enum: VisaSponsorship })
  @IsOptional()
  @IsEnum(VisaSponsorship)
  visaSponsorship?: VisaSponsorship;

  @ApiPropertyOptional({ enum: AusbildungSupport })
  @IsOptional()
  @IsEnum(AusbildungSupport)
  ausbildungSupport?: AusbildungSupport;

  @ApiPropertyOptional({ type: MetadataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MetadataDto)
  metadata?: MetadataDto;
}
