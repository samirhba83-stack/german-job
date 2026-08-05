import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CompanyStatus,
  CompanyIndustry,
  CompanySize,
  VisaSponsorship,
  AusbildungSupport,
} from '@german-job-engine/shared-types';

export class LocationResponseDto {
  @ApiProperty() city!: string;
  @ApiProperty() country!: string;
  @ApiPropertyOptional({ nullable: true }) postalCode!: string | null;
  @ApiPropertyOptional({ nullable: true }) street!: string | null;
}

export class ContactResponseDto {
  @ApiPropertyOptional({ nullable: true }) contactName!: string | null;
  @ApiProperty() contactEmail!: string;
  @ApiPropertyOptional({ nullable: true }) contactPhone!: string | null;
}

export class ScoreResponseDto {
  @ApiProperty() score!: number;
  @ApiProperty() computedAt!: Date;
}

export class MetadataResponseDto {
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiPropertyOptional({ nullable: true }) logoUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) foundedYear!: number | null;
  @ApiProperty({ type: [String] }) tags!: string[];
}

export class CompanyResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() ownerId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: CompanyStatus }) status!: CompanyStatus;
  @ApiProperty({ enum: CompanyIndustry }) industry!: CompanyIndustry;
  @ApiProperty({ enum: CompanySize }) size!: CompanySize;
  @ApiProperty({ type: LocationResponseDto }) location!: LocationResponseDto;
  @ApiPropertyOptional({ nullable: true }) websiteUrl!: string | null;
  @ApiProperty({ type: ContactResponseDto }) contact!: ContactResponseDto;
  @ApiProperty({ enum: VisaSponsorship }) visaSponsorship!: VisaSponsorship;
  @ApiProperty({ enum: AusbildungSupport }) ausbildungSupport!: AusbildungSupport;
  @ApiPropertyOptional({ type: ScoreResponseDto, nullable: true }) hiringQuality!: ScoreResponseDto | null;
  @ApiPropertyOptional({ type: ScoreResponseDto, nullable: true }) trustScore!: ScoreResponseDto | null;
  @ApiProperty({ type: MetadataResponseDto }) metadata!: MetadataResponseDto;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
