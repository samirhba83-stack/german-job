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

export interface ActorReadModel {
  role: CampaignActorRole;
  actorId: string | null;
}

export interface CampaignGoalReadModel {
  targetApplicationCount: number;
  desiredOutcome: CampaignOutcomeGoal;
  deadline: Date | null;
}

export interface CampaignStrategyReadModel {
  type: CampaignStrategyType;
  parameters: Record<string, string | number | boolean>;
}

export interface SmartBatchPlanReadModel {
  baseBatchSize: number;
  minBatchSize: number;
  maxBatchSize: number;
  adaptive: boolean;
  expansionIncrement: number | null;
}

export interface ExecutionWindowReadModel {
  allowedWeekdays: Weekday[];
  dailyStartHour: number;
  dailyEndHour: number;
  timezone: string;
  respectHolidays: boolean;
}

export interface RateLimitProfileReadModel {
  maxPerDay: number;
  maxPerHour: number;
  maxPerCompanyPerWindow: number;
}

export interface CheckpointReadModel {
  lastCompletedBatchId: string;
  cursorPosition: number;
  savedAt: Date;
}

export interface CooldownReadModel {
  startedAt: Date;
  until: Date;
  reason: string;
}

export interface CampaignHealthReadModel {
  healthScore: number | null;
  riskScore: number | null;
  progressScore: number | null;
  successTrend: TrendDirection | null;
  replyTrend: TrendDirection | null;
  performanceTrend: TrendDirection | null;
  computedBy: string;
  computedAt: Date;
}

export interface CampaignIntelligenceReadModel {
  bestSendTime: string | null;
  bestBatchSize: number | null;
  bestCompanyOrder: ReadonlyArray<string> | null;
  replyPrediction: number | null;
  interviewPrediction: number | null;
  offerPrediction: number | null;
  contractPrediction: number | null;
  riskPrediction: number | null;
  decisionExplanation: string | null;
  recommendationExplanation: string | null;
  computedBy: string;
  computedAt: Date;
}

export interface CampaignReadModel {
  id: string;
  ownerId: string;
  name: string;
  status: CampaignStatus;
  strategy: CampaignStrategyReadModel;
  goal: CampaignGoalReadModel;
  batchPlan: SmartBatchPlanReadModel;
  executionWindow: ExecutionWindowReadModel;
  rateLimitProfile: RateLimitProfileReadModel;
  checkpoint: CheckpointReadModel | null;
  cooldown: CooldownReadModel | null;
  health: CampaignHealthReadModel | null;
  intelligence: CampaignIntelligenceReadModel | null;
  targetsCount: number;
  batchesCount: number;
  isTerminal: boolean;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface CampaignTimelineEntryReadModel {
  id: string;
  timestamp: Date;
  actor: ActorReadModel;
  source: string;
  reason: { code: string; note: string | null } | null;
  previousState: CampaignStatus | null;
  currentState: CampaignStatus;
  metadata: Record<string, string | number | boolean>;
  correlationId: string;
  evidenceReference: { type: string; externalId: string; url: string | null } | null;
  aiExplanation: string | null;
}

export interface PaginatedCampaignsReadModel {
  items: CampaignReadModel[];
  total: number;
  page: number;
  limit: number;
}

export interface CampaignTargetStatusBreakdown {
  status: CampaignTargetStatus;
  count: number;
}

export interface CampaignExecutionStatusReadModel {
  campaignId: string;
  status: CampaignStatus;
  currentBatch: { id: string; status: BatchStatus; plannedSize: number; targetIds: ReadonlyArray<string> } | null;
  targetBreakdown: CampaignTargetStatusBreakdown[];
  checkpoint: CheckpointReadModel | null;
  cooldownActive: boolean;
  goalProgress: { dispatched: number; target: number };
}
