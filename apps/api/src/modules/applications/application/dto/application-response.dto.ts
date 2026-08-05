import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ApplicationLifecycleStatus,
  ActorRole,
  ApplicationChannelType,
  TransitionReasonCode,
} from '@german-job-engine/shared-types';

export class ActorResponseDto {
  @ApiProperty({ enum: ActorRole }) role!: ActorRole;
  @ApiPropertyOptional({ nullable: true }) actorId!: string | null;
}

export class ChannelResponseDto {
  @ApiProperty({ enum: ApplicationChannelType }) type!: ApplicationChannelType;
  @ApiPropertyOptional({ nullable: true }) campaignRef!: string | null;
}

export class SnapshotResponseDto {
  @ApiProperty() jobTitle!: string;
  @ApiProperty() companyName!: string;
  @ApiProperty() jobLocation!: string;
  @ApiPropertyOptional({ nullable: true }) salaryRangeSummary!: string | null;
  @ApiProperty() capturedAt!: Date;
}

export class DurationEstimateResponseDto {
  @ApiProperty() amount!: number;
  @ApiProperty() unit!: string;
}

export class IntelligenceResponseDto {
  @ApiPropertyOptional({ nullable: true }) replyProbability!: number | null;
  @ApiPropertyOptional({ nullable: true }) interviewProbability!: number | null;
  @ApiPropertyOptional({ nullable: true }) offerProbability!: number | null;
  @ApiPropertyOptional({ nullable: true }) contractProbability!: number | null;
  @ApiPropertyOptional({ type: DurationEstimateResponseDto, nullable: true })
  expectedTimeToReply!: DurationEstimateResponseDto | null;
  @ApiPropertyOptional({ type: DurationEstimateResponseDto, nullable: true })
  expectedTimeToInterview!: DurationEstimateResponseDto | null;
  @ApiPropertyOptional({ type: DurationEstimateResponseDto, nullable: true })
  expectedTimeToContract!: DurationEstimateResponseDto | null;
  @ApiPropertyOptional({ nullable: true }) confidenceScore!: number | null;
  @ApiPropertyOptional({ nullable: true }) historicalSuccessScore!: number | null;
  @ApiPropertyOptional({ nullable: true }) riskScore!: number | null;
  @ApiPropertyOptional({ nullable: true }) decisionExplanation!: string | null;
  @ApiPropertyOptional({ nullable: true }) recommendationExplanation!: string | null;
  @ApiProperty() computedAt!: Date;
  @ApiProperty() computedBy!: string;
}

export class ApplicationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() candidateId!: string;
  @ApiProperty() jobId!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty({ enum: ApplicationLifecycleStatus }) status!: ApplicationLifecycleStatus;
  @ApiProperty({ type: SnapshotResponseDto }) snapshot!: SnapshotResponseDto;
  @ApiProperty({ type: ChannelResponseDto }) channel!: ChannelResponseDto;
  @ApiPropertyOptional({ type: IntelligenceResponseDto, nullable: true }) intelligence!: IntelligenceResponseDto | null;
  @ApiPropertyOptional({ nullable: true }) submittedAt!: Date | null;
  @ApiProperty() lastActivityAt!: Date;
  @ApiProperty() isTerminal!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class EvidenceReferenceResponseDto {
  @ApiProperty() type!: string;
  @ApiProperty() externalId!: string;
  @ApiPropertyOptional({ nullable: true }) url!: string | null;
}

export class TransitionReasonResponseDto {
  @ApiProperty({ enum: TransitionReasonCode }) code!: TransitionReasonCode;
  @ApiPropertyOptional({ nullable: true }) note!: string | null;
}

export class TimelineEntryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() timestamp!: Date;
  @ApiProperty({ type: ActorResponseDto }) actor!: ActorResponseDto;
  @ApiProperty({ type: ChannelResponseDto }) source!: ChannelResponseDto;
  @ApiPropertyOptional({ type: TransitionReasonResponseDto, nullable: true }) reason!: TransitionReasonResponseDto | null;
  @ApiPropertyOptional({ enum: ApplicationLifecycleStatus, nullable: true })
  previousState!: ApplicationLifecycleStatus | null;
  @ApiProperty({ enum: ApplicationLifecycleStatus }) currentState!: ApplicationLifecycleStatus;
  @ApiProperty({ type: 'object', additionalProperties: true }) metadata!: Record<string, string | number | boolean>;
  @ApiProperty() correlationId!: string;
  @ApiPropertyOptional({ type: EvidenceReferenceResponseDto, nullable: true })
  evidenceReference!: EvidenceReferenceResponseDto | null;
  @ApiPropertyOptional({ nullable: true }) confidence!: number | null;
}

export class ApplicationHistoryEntryResponseDto {
  @ApiProperty() timestamp!: Date;
  @ApiProperty() summary!: string;
  @ApiProperty({ type: ActorResponseDto }) actor!: ActorResponseDto;
}

export class PaginatedApplicationsResponseDto {
  @ApiProperty({ type: [ApplicationResponseDto] }) items!: ApplicationResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
