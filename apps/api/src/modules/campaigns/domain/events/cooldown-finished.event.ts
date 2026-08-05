import { DomainEvent } from '../../../../shared/domain';
import { Actor } from '../value-objects/actor.vo';

export class CooldownFinished extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly correlationId: string,
    public readonly actor: Actor,
  ) {
    super();
  }
}
