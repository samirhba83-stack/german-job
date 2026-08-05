import { ApplicationPolicy, PolicyDecision, allow, deny } from './application-policy.interface';
import { Actor } from '../value-objects/actor.vo';
import { IsOwnedBySpecification } from '../specifications/is-owned-by.specification';

/** Governs QUEUED -> SENT. Only the candidate who owns this application may dispatch it —
 * mirrors WithdrawalPolicy's ownership check. The CorrelationId requirement is enforced
 * structurally (a required constructor parameter), not here. */
export class DispatchPolicy implements ApplicationPolicy {
  readonly name = 'DispatchPolicy';

  authorize(context: { actor: Actor; candidateId: string }): PolicyDecision {
    if (!IsOwnedBySpecification.isSatisfiedBy(context.actor, context.candidateId)) {
      return deny('DISPATCH_REQUIRES_OWNER', 'Only the candidate who owns this application may dispatch it.');
    }

    return allow('DISPATCH_OK', 'Dispatch accepted.');
  }
}
