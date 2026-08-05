import { DomainEvent } from '../../../../shared/domain';
import { Actor } from '../value-objects/actor.vo';
import { CampaignHealth } from '../value-objects/campaign-health.vo';

export class CampaignHealthChanged extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly correlationId: string,
    public readonly actor: Actor,
    public readonly health: CampaignHealth,
  ) {
    super();
  }
}
