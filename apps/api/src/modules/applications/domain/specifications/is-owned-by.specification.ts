import { ActorRole } from '@german-job-engine/shared-types';
import { Actor } from '../value-objects/actor.vo';

/** "This actor is the candidate who owns this Application." The predicate WithdrawalPolicy composes. */
export class IsOwnedBySpecification {
  static isSatisfiedBy(actor: Actor, candidateId: string): boolean {
    return actor.role === ActorRole.CANDIDATE && actor.actorId === candidateId;
  }
}
