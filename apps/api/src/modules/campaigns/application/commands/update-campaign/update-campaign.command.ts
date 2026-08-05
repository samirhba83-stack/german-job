import { CampaignActorRole } from '@german-job-engine/shared-types';
import {
  CreateCampaignGoalInput,
  CreateCampaignStrategyInput,
  CreateCampaignBatchPlanInput,
  CreateCampaignExecutionWindowInput,
  CreateCampaignRateLimitInput,
} from '../create-campaign/create-campaign.command';

export class UpdateCampaignCommand {
  constructor(
    public readonly campaignId: string,
    public readonly actorRole: CampaignActorRole,
    public readonly actorId: string | null,
    public readonly fields: {
      name?: string;
      goal?: CreateCampaignGoalInput;
      strategy?: CreateCampaignStrategyInput;
      batchPlan?: CreateCampaignBatchPlanInput;
      executionWindow?: CreateCampaignExecutionWindowInput;
      rateLimitProfile?: CreateCampaignRateLimitInput;
    },
    public readonly correlationId?: string,
  ) {}
}
