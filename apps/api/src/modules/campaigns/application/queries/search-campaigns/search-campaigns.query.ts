import { CampaignActorRole, CampaignStatus, CampaignStrategyType } from '@german-job-engine/shared-types';

export class SearchCampaignsQuery {
  constructor(
    public readonly requesterRole: CampaignActorRole,
    public readonly requesterId: string | null,
    public readonly ownerId?: string,
    public readonly status?: CampaignStatus,
    public readonly strategyType?: CampaignStrategyType,
    public readonly createdFrom?: Date,
    public readonly createdTo?: Date,
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}
