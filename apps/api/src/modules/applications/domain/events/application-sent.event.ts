import { ApplicationLifecycleStatus } from '@german-job-engine/shared-types';
import { ApplicationLifecycleEvent } from './application-lifecycle.event';
import { Actor } from '../value-objects/actor.vo';

export class ApplicationSent extends ApplicationLifecycleEvent {
  constructor(
    applicationId: string,
    correlationId: string,
    previousState: ApplicationLifecycleStatus,
    currentState: ApplicationLifecycleStatus,
    actor: Actor,
    public readonly submittedAt: Date,
  ) {
    super(applicationId, correlationId, previousState, currentState, actor);
  }
}
