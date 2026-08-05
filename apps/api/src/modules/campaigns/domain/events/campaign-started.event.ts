import { CampaignStatus } from '@german-job-engine/shared-types';
import { CampaignLifecycleEvent } from './campaign-lifecycle.event';
import { Actor } from '../value-objects/actor.vo';

export class CampaignStarted extends CampaignLifecycleEvent {
  constructor(
    campaignId: string,
    correlationId: string,
    previousState: CampaignStatus | null,
    currentState: CampaignStatus,
    actor: Actor,
    public readonly startedAt: Date,
  ) {
    super(campaignId, correlationId, previousState, currentState, actor);
  }
}
