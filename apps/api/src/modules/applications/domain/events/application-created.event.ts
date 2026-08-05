import { ApplicationLifecycleStatus } from '@german-job-engine/shared-types';
import { ApplicationLifecycleEvent } from './application-lifecycle.event';
import { ApplicationSnapshot } from '../value-objects/application-snapshot.vo';
import { ApplicationChannel } from '../value-objects/application-channel.vo';
import { Actor } from '../value-objects/actor.vo';

export class ApplicationCreated extends ApplicationLifecycleEvent {
  constructor(
    applicationId: string,
    correlationId: string,
    currentState: ApplicationLifecycleStatus,
    actor: Actor,
    public readonly snapshot: ApplicationSnapshot,
    public readonly channel: ApplicationChannel,
  ) {
    super(applicationId, correlationId, null, currentState, actor);
  }
}
