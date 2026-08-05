import { ApplicationLifecycleStatus } from '@german-job-engine/shared-types';
import { ApplicationLifecycleEvent } from './application-lifecycle.event';
import { Actor } from '../value-objects/actor.vo';
import { Metadata } from '../value-objects/metadata.vo';

export class InterviewScheduled extends ApplicationLifecycleEvent {
  constructor(
    applicationId: string,
    correlationId: string,
    previousState: ApplicationLifecycleStatus,
    currentState: ApplicationLifecycleStatus,
    actor: Actor,
    public readonly metadata: Metadata,
  ) {
    super(applicationId, correlationId, previousState, currentState, actor);
  }
}
