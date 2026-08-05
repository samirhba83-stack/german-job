import { CampaignActorRole } from '@german-job-engine/shared-types';

export class GetCampaignQuery {
  constructor(
    public readonly campaignId: string,
    public readonly requesterRole: CampaignActorRole,
    public readonly requesterId: string | null,
  ) {}
}
