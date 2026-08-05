import { ActorRole } from '@german-job-engine/shared-types';
import { ApplicationPolicy, PolicyDecision, allow, deny } from './application-policy.interface';
import { Actor } from '../value-objects/actor.vo';

/** Governs -> COMPANY_REPLIED. A reply is recorded by the Company itself or by System automation
 * parsing an inbound reply — never directly by the candidate. */
export class ResponsePolicy implements ApplicationPolicy {
  readonly name = 'ResponsePolicy';

  authorize(context: { actor: Actor }): PolicyDecision {
    if (context.actor.role !== ActorRole.COMPANY && context.actor.role !== ActorRole.SYSTEM) {
      return deny('RESPONSE_REQUIRES_COMPANY_OR_SYSTEM', 'Only the Company or System may record a company reply.');
    }

    return allow('RESPONSE_OK', 'Company reply accepted.');
  }
}
