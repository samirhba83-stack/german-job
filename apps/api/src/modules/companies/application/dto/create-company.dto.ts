import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import { CompanyIndustry, CompanySize, VisaSponsorship, AusbildungSupport } from '@german-job-engine/shared-types';
import { LocationDto } from './location.dto';
import { ContactDto } from './contact.dto';
import { MetadataDto } from './metadata.dto';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Acme GmbH', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ enum: CompanyIndustry })
  @IsEnum(CompanyIndustry)
  industry!: CompanyIndustry;

  @ApiProperty({ enum: CompanySize })
  @IsEnum(CompanySize)
  size!: CompanySize;

  @ApiProperty({ type: LocationDto })
  @ValidateNested()
  @Type(() => LocationDto)
  location!: LocationDto;

  @ApiPropertyOptional({ example: 'https://acme.de' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  websiteUrl?: string;

  @ApiProperty({ type: ContactDto })
  @ValidateNested()
  @Type(() => ContactDto)
  contact!: ContactDto;

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
