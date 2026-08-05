import { ActorRole } from '@german-job-engine/shared-types';
import { ApplicationPolicy, PolicyDecision, allow, deny } from './application-policy.interface';
import { Actor } from '../value-objects/actor.vo';

/** Governs -> OFFER_RECEIVED. Only the Company can extend an offer. */
export class OfferPolicy implements ApplicationPolicy {
  readonly name = 'OfferPolicy';

  authorize(context: { actor: Actor }): PolicyDecision {
    if (context.actor.role !== ActorRole.COMPANY) {
      return deny('OFFER_REQUIRES_COMPANY', 'Only the Company may extend an offer.');
    }

    return allow('OFFER_OK', 'Offer accepted.');
  }
}
