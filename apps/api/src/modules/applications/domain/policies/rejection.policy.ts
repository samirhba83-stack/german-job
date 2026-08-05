import { ActorRole } from '@german-job-engine/shared-types';
import { ApplicationPolicy, PolicyDecision, allow, deny } from './application-policy.interface';
import { Actor } from '../value-objects/actor.vo';

/** Governs -> REJECTED. The Company decides, System may auto-reject under a timeout policy, and
 * an Admin may reject on the Company's behalf. A Candidate cannot "reject" their own application
 * — that action is Withdrawal. */
export class RejectionPolicy implements ApplicationPolicy {
  readonly name = 'RejectionPolicy';

  authorize(context: { actor: Actor }): PolicyDecision {
    if (
      context.actor.role !== ActorRole.COMPANY &&
      context.actor.role !== ActorRole.SYSTEM &&
      context.actor.role !== ActorRole.ADMIN
    ) {
      return deny('REJECTION_REQUIRES_COMPANY', 'Only the Company, an Admin, or System may reject an application.');
    }

    return allow('REJECTION_OK', 'Rejection accepted.');
  }
}
