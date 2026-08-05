import { ReplayScope } from '@german-job-engine/shared-types';
import { DomainEvent } from '../../../../shared/domain';
import { Actor } from '../value-objects/actor.vo';

export class ReplayStarted extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly correlationId: string,
    public readonly actor: Actor,
    public readonly scope: ReplayScope,
    public readonly targetIds: ReadonlyArray<string>,
  ) {
    super();
  }
}
