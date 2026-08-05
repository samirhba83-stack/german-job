import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { CampaignGoalDto } from './campaign-goal.dto';
import { CampaignStrategyDto } from './campaign-strategy.dto';
import { SmartBatchPlanDto } from './smart-batch-plan.dto';
import { ExecutionWindowDto } from './execution-window.dto';
import { RateLimitProfileDto } from './rate-limit-profile.dto';

export class UpdateCampaignDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 150 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ type: CampaignGoalDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignGoalDto)
  goal?: CampaignGoalDto;

  @ApiPropertyOptional({ type: CampaignStrategyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignStrategyDto)
  strategy?: CampaignStrategyDto;

  @ApiPropertyOptional({ type: SmartBatchPlanDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SmartBatchPlanDto)
  batchPlan?: SmartBatchPlanDto;

  @ApiPropertyOptional({ type: ExecutionWindowDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExecutionWindowDto)
  executionWindow?: ExecutionWindowDto;

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
