import { CampaignActorRole, CampaignReasonCode } from '@german-job-engine/shared-types';

export class PauseCampaignCommand {
  constructor(
    public readonly campaignId: string,
    public readonly actorRole: CampaignActorRole,
    public readonly actorId: string | null,
    public readonly correlationId?: string,
    public readonly reasonCode?: CampaignReasonCode,
    public readonly reasonNote?: string,
  ) {}
}
