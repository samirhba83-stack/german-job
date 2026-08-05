import { CampaignActorRole } from '@german-job-engine/shared-types';

export class AddCampaignTargetCommand {
  constructor(
    public readonly campaignId: string,
    public readonly jobId: string,
    public readonly companyId: string,
    public readonly actorRole: CampaignActorRole,
    public readonly actorId: string | null,
    public readonly correlationId?: string,
  ) {}
}
