import { ApplicationPolicy, PolicyDecision, allow, deny } from './application-policy.interface';
import { Actor } from '../value-objects/actor.vo';
import { IsOwnedBySpecification } from '../specifications/is-owned-by.specification';

/** Governs -> WITHDRAWN. The one policy that checks actor identity, not just role — a Company
 * cannot withdraw an application on a candidate's behalf. */
export class WithdrawalPolicy implements ApplicationPolicy {
  readonly name = 'WithdrawalPolicy';

  authorize(context: { actor: Actor; candidateId: string }): PolicyDecision {
    if (!IsOwnedBySpecification.isSatisfiedBy(context.actor, context.candidateId)) {
      return deny('WITHDRAWAL_REQUIRES_OWNER', 'Only the candidate who owns this application may withdraw it.');
    }

    return allow('WITHDRAWAL_OK', 'Withdrawal accepted.');
  }
}
