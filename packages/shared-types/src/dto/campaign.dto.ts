import {
  CampaignStatus,
  CampaignActorRole,
  CampaignStrategyType,
  CampaignOutcomeGoal,
  CampaignTargetStatus,
  BatchStatus,
  TrendDirection,
  Weekday,
} from '../enums';

export interface CampaignActorDto {
  role: CampaignActorRole;
  actorId: string | null;
}

export interface CampaignGoalDto {
  targetApplicationCount: number;
  desiredOutcome: CampaignOutcomeGoal;
  deadline: string | null;
}

export interface CampaignStrategyDto {
  type: CampaignStrategyType;
  parameters: Record<string, string | number | boolean>;
}

export interface SmartBatchPlanDto {
  baseBatchSize: number;
  minBatchSize: number;
  maxBatchSize: number;
  adaptive: boolean;
  expansionIncrement: number | null;
}

export interface ExecutionWindowDto {
  allowedWeekdays: Weekday[];
  dailyStartHour: number;
  dailyEndHour: number;
  timezone: string;
  respectHolidays: boolean;
}

export interface RateLimitProfileDto {
  maxPerDay: number;
  maxPerHour: number;
  maxPerCompanyPerWindow: number;
}

export interface CampaignCheckpointDto {
  lastCompletedBatchId: string;
  cursorPosition: number;
  savedAt: string;
}

export interface CampaignCooldownDto {
  startedAt: string;
  until: string;
  reason: string;
}

/** Reserved — see docs/career-intelligence. `GET /campaigns/:id/health` is a real, live endpoint,
 * but no production code path calls `Campaign.recordHealthAssessment()` today (only test fixtures
 * do) — every field here is `null` for every real campaign right now. Render honestly: `null`
 * means "not yet assessed," never "zero" or "healthy by default." */
export interface CampaignHealthDto {
  healthScore: number | null;
  riskScore: number | null;
  progressScore: number | null;
  successTrend: TrendDirection | null;
  replyTrend: TrendDirection | null;
  performanceTrend: TrendDirection | null;
  computedBy: string;
  computedAt: string;
}

/** Reserved — same status as CampaignHealthDto. `recordIntelligenceAssessment()` has no
 * production caller; every field is `null` for every real campaign right now. */
export interface CampaignIntelligenceDto {
  bestSendTime: string | null;
  bestBatchSize: number | null;
  bestCompanyOrder: readonly string[] | null;
  replyPrediction: number | null;
  interviewPrediction: number | null;
  offerPrediction: number | null;
  contractPrediction: number | null;
  riskPrediction: number | null;
  decisionExplanation: string | null;
  recommendationExplanation: string | null;
  computedBy: string;
  computedAt: string;
}

export interface CampaignDto {
  id: string;
  ownerId: string;
  name: string;
  status: CampaignStatus;
  strategy: CampaignStrategyDto;
  goal: CampaignGoalDto;
  batchPlan: SmartBatchPlanDto;
  executionWindow: ExecutionWindowDto;
  rateLimitProfile: RateLimitProfileDto;
  checkpoint: CampaignCheckpointDto | null;
  cooldown: CampaignCooldownDto | null;
  health: CampaignHealthDto | null;
  intelligence: CampaignIntelligenceDto | null;
  targetsCount: number;
  batchesCount: number;
  isTerminal: boolean;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface CampaignEvidenceReferenceDto {
  type: string;
  externalId: string;
  url: string | null;
}

export interface CampaignTransitionReasonDto {
  code: string;
  note: string | null;
}

/** `GET /campaigns/:id/timeline` — a real, structured ledger of every real status transition;
 * `aiExplanation` is a real field on the DTO but, like CampaignIntelligenceDto, has no production
 * writer today — render its absence honestly rather than assuming it will be populated. */
export interface CampaignTimelineEntryDto {
  id: string;
  timestamp: string;
  actor: CampaignActorDto;
  source: string;
  reason: CampaignTransitionReasonDto | null;
  previousState: CampaignStatus | null;
  currentState: CampaignStatus;
  metadata: Record<string, string | number | boolean>;
  correlationId: string;
  evidenceReference: CampaignEvidenceReferenceDto | null;
  aiExplanation: string | null;
}

export interface PaginatedCampaignsDto {
  items: CampaignDto[];
  total: number;
  page: number;
  limit: number;
}

/** `GET /campaigns/:id/execution-status`'s `targetBreakdown` — real, live aggregate counts per
 * CampaignTargetStatus. This is the only real per-target signal the backend exposes today: there
 * is no endpoint that lists individual targets/companies with their own status (see
 * docs/campaign-workspace/03-integration-points.md). */
export interface CampaignTargetStatusBreakdownDto {
  status: CampaignTargetStatus;
  count: number;
}

export interface CampaignBatchSummaryDto {
  id: string;
  status: BatchStatus;
  plannedSize: number;
  targetIds: readonly string[];
}

export interface CampaignGoalProgressDto {
  dispatched: number;
  target: number;
}

export interface CampaignExecutionStatusDto {
  campaignId: string;
  status: CampaignStatus;
  currentBatch: CampaignBatchSummaryDto | null;
  targetBreakdown: CampaignTargetStatusBreakdownDto[];
  checkpoint: CampaignCheckpointDto | null;
  cooldownActive: boolean;
  goalProgress: CampaignGoalProgressDto;
}
