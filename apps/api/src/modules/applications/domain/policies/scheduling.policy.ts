import { ApplicationPolicy, PolicyDecision, allow, deny } from './application-policy.interface';
import { Actor } from '../value-objects/actor.vo';
import { IsOwnedBySpecification } from '../specifications/is-owned-by.specification';

/** Governs PREPARED -> QUEUED. Only the candidate who owns this application may queue it —
 * mirrors WithdrawalPolicy's ownership check. */
export class SchedulingPolicy implements ApplicationPolicy {
  readonly name = 'SchedulingPolicy';

  authorize(context: { actor: Actor; candidateId: string }): PolicyDecision {
    if (!IsOwnedBySpecification.isSatisfiedBy(context.actor, context.candidateId)) {
      return deny('SCHEDULING_REQUIRES_OWNER', 'Only the candidate who owns this application may queue it.');
    }

    return allow('SCHEDULING_OK', 'Queueing accepted.');
  }
}
