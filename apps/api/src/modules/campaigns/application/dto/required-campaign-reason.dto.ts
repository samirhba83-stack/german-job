import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CampaignReasonCode } from '@german-job-engine/shared-types';

/** Shared body shape for the only transition whose reason is mandatory: cancel. */
export class RequiredCampaignReasonDto {
  @ApiProperty({ enum: CampaignReasonCode })
  @IsEnum(CampaignReasonCode)
  reasonCode!: CampaignReasonCode;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reasonNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  correlationId?: string;
}
