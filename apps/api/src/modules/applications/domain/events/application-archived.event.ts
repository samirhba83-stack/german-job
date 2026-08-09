import { ApplicationLifecycleStatus } from '@german-job-engine/shared-types';
import { ApplicationLifecycleEvent } from './application-lifecycle.event';
import { Actor } from '../value-objects/actor.vo';
import { TransitionReason } from '../value-objects/transition-reason.vo';

/** `reason` (M31.1) — optional (candidate/company archival doesn't require one; admin archival
 * does, enforced by `ArchivalPolicy`) but carried on the event when present, matching
 * `ApplicationRejected`/`ApplicationWithdrawn`'s own shape. */
export class ApplicationArchived extends ApplicationLifecycleEvent {
  constructor(
    applicationId: string,
    correlationId: string,
    previousState: ApplicationLifecycleStatus | null,
    currentState: ApplicationLifecycleStatus,
    actor: Actor,
    public readonly reason: TransitionReason | null,
  ) {
    super(applicationId, correlationId, previousState, currentState, actor);
  }
}
