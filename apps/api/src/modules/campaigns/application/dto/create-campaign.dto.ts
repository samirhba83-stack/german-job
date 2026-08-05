import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { CampaignGoalDto } from './campaign-goal.dto';
import { CampaignStrategyDto } from './campaign-strategy.dto';
import { SmartBatchPlanDto } from './smart-batch-plan.dto';
import { ExecutionWindowDto } from './execution-window.dto';
import { RateLimitProfileDto } from './rate-limit-profile.dto';

/**
 * ownerId is intentionally not part of the body — a candidate can only ever create a campaign
 * for themselves; the handler derives it from the authenticated user (mirrors CreateJobDto).
 */
export class CreateCampaignDto {
  @ApiProperty({ example: 'Berlin Backend Roles', minLength: 1, maxLength: 150 })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @ApiProperty({ type: CampaignGoalDto })
  @ValidateNested()
  @Type(() => CampaignGoalDto)
  goal!: CampaignGoalDto;

  @ApiProperty({ type: CampaignStrategyDto })
  @ValidateNested()
  @Type(() => CampaignStrategyDto)
  strategy!: CampaignStrategyDto;

  @ApiProperty({ type: SmartBatchPlanDto })
  @ValidateNested()
  @Type(() => SmartBatchPlanDto)
  batchPlan!: SmartBatchPlanDto;

  @ApiProperty({ type: ExecutionWindowDto })
  @ValidateNested()
  @Type(() => ExecutionWindowDto)
  executionWindow!: ExecutionWindowDto;

  @ApiPropertyOptional({ type: RateLimitProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RateLimitProfileDto)
  rateLimitProfile?: RateLimitProfileDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  correlationId?: string;
}
