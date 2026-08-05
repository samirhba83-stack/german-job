import { CampaignActorRole, ReplayScope } from '@german-job-engine/shared-types';

export class ReplayCampaignCommand {
  constructor(
    public readonly campaignId: string,
    public readonly actorRole: CampaignActorRole,
    public readonly actorId: string | null,
    public readonly scope: ReplayScope,
    public readonly targetIds?: string[],
    public readonly correlationId?: string,
  ) {}
}
