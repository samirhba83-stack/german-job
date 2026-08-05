import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { ApplicationChannelType } from '@german-job-engine/shared-types';

export class ApplicationSnapshotDto {
  @ApiProperty({ example: 'Senior Backend Engineer' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  jobTitle!: string;

  @ApiProperty({ example: 'Acme GmbH' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  companyName!: string;

  @ApiProperty({ example: 'Berlin, Germany' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  jobLocation!: string;

  @ApiPropertyOptional({ example: '55.000 - 70.000 EUR / year' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  salaryRangeSummary?: string;
}

/**
 * candidateId is intentionally not part of the body — the controller derives it from the
 * authenticated candidate's own JWT, mirroring how CreateJobDto omits companyId.
 */
export class CreateApplicationDto {
  @ApiProperty()
  @IsUUID()
  jobId!: string;

  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiProperty({ type: ApplicationSnapshotDto })
  @ValidateNested()
  @Type(() => ApplicationSnapshotDto)
  snapshot!: ApplicationSnapshotDto;

  @ApiPropertyOptional({ enum: ApplicationChannelType, default: ApplicationChannelType.DIRECT })
  @IsOptional()
  @IsEnum(ApplicationChannelType)
  channelType?: ApplicationChannelType;

  @ApiPropertyOptional({ description: 'Required when channelType is CAMPAIGN' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  campaignRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  correlationId?: string;
}
