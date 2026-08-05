import { ApplicationPolicy, PolicyDecision, allow, deny } from './application-policy.interface';
import { Actor } from '../value-objects/actor.vo';
import { IsOwnedBySpecification } from '../specifications/is-owned-by.specification';

/** Governs -> CONTRACT_SIGNED. Only the candidate who owns this application signs it. The
 * one-way door: nothing but ArchivalPolicy may act on an Application afterward. */
export class ContractPolicy implements ApplicationPolicy {
  readonly name = 'ContractPolicy';

  authorize(context: { actor: Actor; candidateId: string }): PolicyDecision {
    if (!IsOwnedBySpecification.isSatisfiedBy(context.actor, context.candidateId)) {
      return deny('CONTRACT_REQUIRES_OWNER', 'Only the candidate who owns this application may sign the contract.');
    }

    return allow('CONTRACT_OK', 'Contract signature accepted.');
  }
}
