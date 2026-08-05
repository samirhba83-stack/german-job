import { CampaignActorRole, CampaignOutcomeGoal, CampaignStrategyType, Weekday } from '@german-job-engine/shared-types';

export interface CreateCampaignGoalInput {
  targetApplicationCount: number;
  desiredOutcome: CampaignOutcomeGoal;
  deadline?: Date;
}

export interface CreateCampaignStrategyInput {
  type: CampaignStrategyType;
  parameters?: Record<string, string | number | boolean>;
}

export interface CreateCampaignBatchPlanInput {
  baseBatchSize: number;
  minBatchSize: number;
  maxBatchSize: number;
  adaptive?: boolean;
  expansionIncrement?: number;
}

export interface CreateCampaignExecutionWindowInput {
  allowedWeekdays: Weekday[];
  dailyStartHour: number;
  dailyEndHour: number;
  timezone: string;
  respectHolidays?: boolean;
}

export interface CreateCampaignRateLimitInput {
  maxPerDay: number;
  maxPerHour: number;
  maxPerCompanyPerWindow: number;
}

export class CreateCampaignCommand {
  constructor(
    public readonly ownerId: string,
    public readonly name: string,
    public readonly goal: CreateCampaignGoalInput,
    public readonly strategy: CreateCampaignStrategyInput,
    public readonly batchPlan: CreateCampaignBatchPlanInput,
    public readonly executionWindow: CreateCampaignExecutionWindowInput,
    public readonly actorRole: CampaignActorRole,
    public readonly actorId: string | null,
    public readonly rateLimitProfile?: CreateCampaignRateLimitInput,
    public readonly correlationId?: string,
  ) {}
}
