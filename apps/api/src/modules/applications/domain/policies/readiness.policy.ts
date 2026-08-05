import { ApplicationPolicy, PolicyDecision, allow, deny } from './application-policy.interface';
import { Actor } from '../value-objects/actor.vo';
import { IsOwnedBySpecification } from '../specifications/is-owned-by.specification';

/** Governs DRAFT -> PREPARED. Only the candidate who owns this application may prepare it —
 * mirrors WithdrawalPolicy's ownership check. */
export class ReadinessPolicy implements ApplicationPolicy {
  readonly name = 'ReadinessPolicy';

  authorize(context: { actor: Actor; candidateId: string }): PolicyDecision {
    if (!IsOwnedBySpecification.isSatisfiedBy(context.actor, context.candidateId)) {
      return deny('READINESS_REQUIRES_OWNER', 'Only the candidate who owns this application may prepare it.');
    }

    return allow('READINESS_OK', 'Preparation accepted.');
  }
}
