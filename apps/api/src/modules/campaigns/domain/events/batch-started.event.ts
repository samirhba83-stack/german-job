import { DomainEvent } from '../../../../shared/domain';
import { Actor } from '../value-objects/actor.vo';

export class BatchStarted extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly correlationId: string,
    public readonly actor: Actor,
    public readonly batchId: string,
    public readonly targetIds: ReadonlyArray<string>,
  ) {
    super();
  }
}
