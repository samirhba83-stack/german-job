import { ApplicationLifecycleStatus } from '@german-job-engine/shared-types';
import { DomainEvent } from '../../../../shared/domain';
import { Actor } from '../value-objects/actor.vo';

/** Common envelope every lifecycle event carries — applicationId, correlation, state change, actor. */
export abstract class ApplicationLifecycleEvent extends DomainEvent {
  constructor(
    public readonly applicationId: string,
    public readonly correlationId: string,
    public readonly previousState: ApplicationLifecycleStatus | null,
    public readonly currentState: ApplicationLifecycleStatus,
    public readonly actor: Actor,
  ) {
    super();
  }
}
