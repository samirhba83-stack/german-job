import { ReplayScope } from '@german-job-engine/shared-types';
import { DomainEvent } from '../../../../shared/domain';
import { Actor } from '../value-objects/actor.vo';

export class ReplayCompleted extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly correlationId: string,
    public readonly actor: Actor,
    public readonly scope: ReplayScope,
  ) {
    super();
  }
}
