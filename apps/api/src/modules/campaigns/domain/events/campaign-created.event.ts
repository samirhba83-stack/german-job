import { CampaignStatus } from '@german-job-engine/shared-types';
import { CampaignLifecycleEvent } from './campaign-lifecycle.event';
import { Actor } from '../value-objects/actor.vo';
import { CampaignName } from '../value-objects/campaign-name.vo';
import { CampaignGoal } from '../value-objects/campaign-goal.vo';

export class CampaignCreated extends CampaignLifecycleEvent {
  constructor(
    campaignId: string,
    correlationId: string,
    currentState: CampaignStatus,
    actor: Actor,
    public readonly name: CampaignName,
    public readonly goal: CampaignGoal,
  ) {
    super(campaignId, correlationId, null, currentState, actor);
  }
}
