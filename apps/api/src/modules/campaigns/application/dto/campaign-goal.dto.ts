import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { CampaignOutcomeGoal } from '@german-job-engine/shared-types';

export class CampaignGoalDto {
  @ApiProperty({ minimum: 1, example: 20 })
  @IsInt()
  @Min(1)
  targetApplicationCount!: number;

  @ApiProperty({ enum: CampaignOutcomeGoal })
  @IsEnum(CampaignOutcomeGoal)
  desiredOutcome!: CampaignOutcomeGoal;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  deadline?: Date;
}
