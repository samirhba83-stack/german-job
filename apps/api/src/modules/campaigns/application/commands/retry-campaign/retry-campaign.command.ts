import { CampaignActorRole } from '@german-job-engine/shared-types';

export class RetryCampaignCommand {
  constructor(
    public readonly campaignId: string,
    public readonly actorRole: CampaignActorRole,
    public readonly actorId: string | null,
    public readonly maxAttempts?: number,
    public readonly correlationId?: string,
  ) {}
}
