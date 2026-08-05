import { CampaignActorRole } from '@german-job-engine/shared-types';

export class CompleteCampaignCommand {
  constructor(
    public readonly campaignId: string,
    public readonly actorRole: CampaignActorRole,
    public readonly actorId: string | null,
    public readonly correlationId?: string,
  ) {}
}
