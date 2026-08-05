import { DomainEvent } from '../../../../shared/domain';
import { Actor } from '../value-objects/actor.vo';
import { CooldownPeriod } from '../value-objects/cooldown-period.vo';

export class CooldownStarted extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly correlationId: string,
    public readonly actor: Actor,
    public readonly cooldown: CooldownPeriod,
  ) {
    super();
  }
}
