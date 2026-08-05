import { ApplicationLifecycleStatus } from '@german-job-engine/shared-types';
import { ApplicationLifecycleEvent } from './application-lifecycle.event';
import { Actor } from '../value-objects/actor.vo';
import { TransitionReason } from '../value-objects/transition-reason.vo';

export class ApplicationRejected extends ApplicationLifecycleEvent {
  constructor(
    applicationId: string,
    correlationId: string,
    previousState: ApplicationLifecycleStatus,
    currentState: ApplicationLifecycleStatus,
    actor: Actor,
    public readonly reason: TransitionReason,
  ) {
    super(applicationId, correlationId, previousState, currentState, actor);
  }
}
