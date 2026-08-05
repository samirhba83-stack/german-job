import { DomainEvent } from '../../../../shared/domain';
import { Actor } from '../value-objects/actor.vo';

export class CampaignTargetAdded extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly correlationId: string,
    public readonly actor: Actor,
    public readonly targetId: string,
    public readonly jobId: string,
    public readonly companyId: string,
  ) {
    super();
  }
}
