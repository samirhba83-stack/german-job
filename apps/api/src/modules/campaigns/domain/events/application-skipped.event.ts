import { DomainEvent } from '../../../../shared/domain';
import { Actor } from '../value-objects/actor.vo';
import { CampaignReason } from '../value-objects/campaign-reason.vo';

export class ApplicationSkipped extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly correlationId: string,
    public readonly actor: Actor,
    public readonly targetId: string,
    public readonly reason: CampaignReason,
  ) {
    super();
  }
}
