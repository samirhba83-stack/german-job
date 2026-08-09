import { ActorRole } from '@german-job-engine/shared-types';
import { Actor } from '../value-objects/actor.vo';

/** "This actor is the employer user who owns the company this Application belongs to." Mirrors
 * `IsOwnedBySpecification`'s shape for the candidate side. `companyOwnerId` is pre-resolved by the
 * application-layer handler (a real repository lookup — `Company.ownerId` — which the domain layer
 * itself cannot perform, since domain policies are synchronous and do no I/O) and passed in as
 * already-known data, the same way `candidateId` is already a direct field on `Application` itself. */
export class IsCompanyOwnerSpecification {
  static isSatisfiedBy(actor: Actor, companyOwnerId: string | null): boolean {
    return actor.role === ActorRole.COMPANY && companyOwnerId !== null && actor.actorId === companyOwnerId;
  }
}
