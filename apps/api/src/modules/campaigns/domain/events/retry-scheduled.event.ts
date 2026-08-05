import { DomainEvent } from '../../../../shared/domain';
import { Actor } from '../value-objects/actor.vo';

export class RetryScheduled extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly correlationId: string,
    public readonly actor: Actor,
    public readonly targetId: string,
    public readonly attemptNumber: number,
  ) {
    super();
  }
}
