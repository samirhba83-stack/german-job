import { DomainEvent } from '../../../../shared/domain';
import { Actor } from '../value-objects/actor.vo';
import { Checkpoint } from '../value-objects/checkpoint.vo';

export class CheckpointSaved extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly correlationId: string,
    public readonly actor: Actor,
    public readonly checkpoint: Checkpoint,
  ) {
    super();
  }
}
