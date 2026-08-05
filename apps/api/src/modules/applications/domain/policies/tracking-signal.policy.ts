import { ActorRole } from '@german-job-engine/shared-types';
import { ApplicationPolicy, PolicyDecision, allow, deny } from './application-policy.interface';
import { Actor } from '../value-objects/actor.vo';

/** Governs DELIVERED / OPENED / VIEWED. These are passive signals — only System may record them. */
export class TrackingSignalPolicy implements ApplicationPolicy {
  readonly name = 'TrackingSignalPolicy';

  authorize(context: { actor: Actor }): PolicyDecision {
    if (context.actor.role !== ActorRole.SYSTEM) {
      return deny('TRACKING_SIGNAL_REQUIRES_SYSTEM', 'Only the System may record a passive tracking signal.');
    }

    return allow('TRACKING_SIGNAL_OK', 'System-recorded tracking signal accepted.');
  }
}
