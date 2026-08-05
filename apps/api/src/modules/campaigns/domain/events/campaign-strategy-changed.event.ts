import { DomainEvent } from '../../../../shared/domain';
import { Actor } from '../value-objects/actor.vo';
import { CampaignStrategyProfile } from '../value-objects/campaign-strategy-profile.vo';

export class CampaignStrategyChanged extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly correlationId: string,
    public readonly actor: Actor,
    public readonly previousStrategy: CampaignStrategyProfile,
    public readonly newStrategy: CampaignStrategyProfile,
  ) {
    super();
  }
}
