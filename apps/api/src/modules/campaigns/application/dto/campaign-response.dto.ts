import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CampaignStatus,
  CampaignActorRole,
  CampaignStrategyType,
  CampaignOutcomeGoal,
  CampaignTargetStatus,
  BatchStatus,
  TrendDirection,
  Weekday,
} from '@german-job-engine/shared-types';

export class ActorResponseDto {
  @ApiProperty({ enum: CampaignActorRole }) role!: CampaignActorRole;
  @ApiPropertyOptional({ nullable: true }) actorId!: string | null;
}

export class CampaignGoalResponseDto {
  @ApiProperty() targetApplicationCount!: number;
  @ApiProperty({ enum: CampaignOutcomeGoal }) desiredOutcome!: CampaignOutcomeGoal;
  @ApiPropertyOptional({ nullable: true }) deadline!: Date | null;
}

export class CampaignStrategyResponseDto {
  @ApiProperty({ enum: CampaignStrategyType }) type!: CampaignStrategyType;
  @ApiProperty({ type: 'object', additionalProperties: true }) parameters!: Record<string, string | number | boolean>;
}

export class SmartBatchPlanResponseDto {
  @ApiProperty() baseBatchSize!: number;
  @ApiProperty() minBatchSize!: number;
  @ApiProperty() maxBatchSize!: number;
  @ApiProperty() adaptive!: boolean;
  @ApiPropertyOptional({ nullable: true }) expansionIncrement!: number | null;
}

export class ExecutionWindowResponseDto {
  @ApiProperty({ enum: Weekday, isArray: true }) allowedWeekdays!: Weekday[];
  @ApiProperty() dailyStartHour!: number;
  @ApiProperty() dailyEndHour!: number;
  @ApiProperty() timezone!: string;
  @ApiProperty() respectHolidays!: boolean;
}

export class RateLimitProfileResponseDto {
  @ApiProperty() maxPerDay!: number;
  @ApiProperty() maxPerHour!: number;
  @ApiProperty() maxPerCompanyPerWindow!: number;
}

export class CheckpointResponseDto {
  @ApiProperty() lastCompletedBatchId!: string;
  @ApiProperty() cursorPosition!: number;
  @ApiProperty() savedAt!: Date;
}

export class CooldownResponseDto {
  @ApiProperty() startedAt!: Date;
  @ApiProperty() until!: Date;
  @ApiProperty() reason!: string;
}

export class CampaignHealthResponseDto {
  @ApiPropertyOptional({ nullable: true }) healthScore!: number | null;
  @ApiPropertyOptional({ nullable: true }) riskScore!: number | null;
  @ApiPropertyOptional({ nullable: true }) progressScore!: number | null;
  @ApiPropertyOptional({ enum: TrendDirection, nullable: true }) successTrend!: TrendDirection | null;
  @ApiPropertyOptional({ enum: TrendDirection, nullable: true }) replyTrend!: TrendDirection | null;
  @ApiPropertyOptional({ enum: TrendDirection, nullable: true }) performanceTrend!: TrendDirection | null;
  @ApiProperty() computedBy!: string;
  @ApiProperty() computedAt!: Date;
}

export class CampaignIntelligenceResponseDto {
  @ApiPropertyOptional({ nullable: true }) bestSendTime!: string | null;
  @ApiPropertyOptional({ nullable: true }) bestBatchSize!: number | null;
  @ApiPropertyOptional({ type: [String], nullable: true }) bestCompanyOrder!: ReadonlyArray<string> | null;
  @ApiPropertyOptional({ nullable: true }) replyPrediction!: number | null;
  @ApiPropertyOptional({ nullable: true }) interviewPrediction!: number | null;
  @ApiPropertyOptional({ nullable: true }) offerPrediction!: number | null;
  @ApiPropertyOptional({ nullable: true }) contractPrediction!: number | null;
  @ApiPropertyOptional({ nullable: true }) riskPrediction!: number | null;
  @ApiPropertyOptional({ nullable: true }) decisionExplanation!: string | null;
  @ApiPropertyOptional({ nullable: true }) recommendationExplanation!: string | null;
  @ApiProperty() computedBy!: string;
  @ApiProperty() computedAt!: Date;
}

export class CampaignResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() ownerId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: CampaignStatus }) status!: CampaignStatus;
  @ApiProperty({ type: CampaignStrategyResponseDto }) strategy!: CampaignStrategyResponseDto;
  @ApiProperty({ type: CampaignGoalResponseDto }) goal!: CampaignGoalResponseDto;
  @ApiProperty({ type: SmartBatchPlanResponseDto }) batchPlan!: SmartBatchPlanResponseDto;
  @ApiProperty({ type: ExecutionWindowResponseDto }) executionWindow!: ExecutionWindowResponseDto;
  @ApiProperty({ type: RateLimitProfileResponseDto }) rateLimitProfile!: RateLimitProfileResponseDto;
  @ApiPropertyOptional({ type: CheckpointResponseDto, nullable: true }) checkpoint!: CheckpointResponseDto | null;
  @ApiPropertyOptional({ type: CooldownResponseDto, nullable: true }) cooldown!: CooldownResponseDto | null;
  @ApiPropertyOptional({ type: CampaignHealthResponseDto, nullable: true }) health!: CampaignHealthResponseDto | null;
  @ApiPropertyOptional({ type: CampaignIntelligenceResponseDto, nullable: true }) intelligence!: CampaignIntelligenceResponseDto | null;
  @ApiProperty() targetsCount!: number;
  @ApiProperty() batchesCount!: number;
  @ApiProperty() isTerminal!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional({ nullable: true }) startedAt!: Date | null;
  @ApiPropertyOptional({ nullable: true }) completedAt!: Date | null;
}

export class CampaignTimelineEntryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() timestamp!: Date;
  @ApiProperty({ type: ActorResponseDto }) actor!: ActorResponseDto;
  @ApiProperty() source!: string;
  @ApiPropertyOptional({ nullable: true }) reason!: { code: string; note: string | null } | null;
  @ApiPropertyOptional({ enum: CampaignStatus, nullable: true }) previousState!: CampaignStatus | null;
  @ApiProperty({ enum: CampaignStatus }) currentState!: CampaignStatus;
  @ApiProperty({ type: 'object', additionalProperties: true }) metadata!: Record<string, string | number | boolean>;
  @ApiProperty() correlationId!: string;
  @ApiPropertyOptional({ nullable: true }) evidenceReference!: { type: string; externalId: string; url: string | null } | null;
  @ApiPropertyOptional({ nullable: true }) aiExplanation!: string | null;
}

export class PaginatedCampaignsResponseDto {
  @ApiProperty({ type: [CampaignResponseDto] }) items!: CampaignResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class CampaignTargetStatusBreakdownResponseDto {
  @ApiProperty({ enum: CampaignTargetStatus }) status!: CampaignTargetStatus;
  @ApiProperty() count!: number;
}

export class CampaignBatchSummaryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: BatchStatus }) status!: BatchStatus;
  @ApiProperty() plannedSize!: number;
  @ApiProperty({ type: [String] }) targetIds!: ReadonlyArray<string>;
}

export class CampaignExecutionStatusResponseDto {
  @ApiProperty() campaignId!: string;
  @ApiProperty({ enum: CampaignStatus }) status!: CampaignStatus;
  @ApiPropertyOptional({ type: CampaignBatchSummaryResponseDto, nullable: true }) currentBatch!: CampaignBatchSummaryResponseDto | null;
  @ApiProperty({ type: [CampaignTargetStatusBreakdownResponseDto] }) targetBreakdown!: CampaignTargetStatusBreakdownResponseDto[];
  @ApiPropertyOptional({ type: CheckpointResponseDto, nullable: true }) checkpoint!: CheckpointResponseDto | null;
  @ApiProperty() cooldownActive!: boolean;
  @ApiProperty({ type: 'object' }) goalProgress!: { dispatched: number; target: number };
}
