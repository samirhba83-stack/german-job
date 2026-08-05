import { DomainEvent } from '../../../../shared/domain';
import { Actor } from '../value-objects/actor.vo';
import { CampaignGoal } from '../value-objects/campaign-goal.vo';

export class DynamicGoalReached extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly correlationId: string,
    public readonly actor: Actor,
    public readonly goal: CampaignGoal,
  ) {
    super();
  }
}
