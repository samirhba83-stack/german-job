import { CampaignActorRole } from '@german-job-engine/shared-types';

export class ListCampaignsQuery {
  constructor(
    public readonly requesterRole: CampaignActorRole,
    public readonly requesterId: string | null,
    public readonly ownerId?: string,
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}
