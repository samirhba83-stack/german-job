import { DomainEvent } from '../../../../shared/domain';
import { Actor } from '../value-objects/actor.vo';
import { CampaignGoal } from '../value-objects/campaign-goal.vo';

export class DynamicGoalAdjusted extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly correlationId: string,
    public readonly actor: Actor,
    public readonly previousGoal: CampaignGoal,
    public readonly newGoal: CampaignGoal,
  ) {
    super();
  }
}
