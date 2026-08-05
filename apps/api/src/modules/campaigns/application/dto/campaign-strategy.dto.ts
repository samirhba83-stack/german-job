import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional } from 'class-validator';
import { CampaignStrategyType } from '@german-job-engine/shared-types';

export class CampaignStrategyDto {
  @ApiProperty({ enum: CampaignStrategyType })
  @IsEnum(CampaignStrategyType)
  type!: CampaignStrategyType;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, string | number | boolean>;
}
