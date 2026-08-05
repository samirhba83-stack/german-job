import { CampaignStatus } from '@german-job-engine/shared-types';
import { CampaignLifecycleEvent } from './campaign-lifecycle.event';
import { Actor } from '../value-objects/actor.vo';
import { CampaignReason } from '../value-objects/campaign-reason.vo';

export class CampaignCancelled extends CampaignLifecycleEvent {
  constructor(
    campaignId: string,
    correlationId: string,
    previousState: CampaignStatus | null,
    currentState: CampaignStatus,
    actor: Actor,
    public readonly reason: CampaignReason,
  ) {
    super(campaignId, correlationId, previousState, currentState, actor);
  }
}
