import { CampaignActorRole, CampaignReasonCode } from '@german-job-engine/shared-types';

export class CancelCampaignCommand {
  constructor(
    public readonly campaignId: string,
    public readonly actorRole: CampaignActorRole,
    public readonly actorId: string | null,
    public readonly reasonCode: CampaignReasonCode,
    public readonly reasonNote?: string,
    public readonly correlationId?: string,
  ) {}
}
