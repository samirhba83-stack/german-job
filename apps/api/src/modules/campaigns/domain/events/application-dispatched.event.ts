import { DomainEvent } from '../../../../shared/domain';
import { Actor } from '../value-objects/actor.vo';
import { EvidenceReference } from '../value-objects/evidence-reference.vo';

/**
 * The signal a future orchestrator listens for to actually issue a CreateApplicationCommand
 * against the Applications module — this domain never calls that module directly.
 */
export class ApplicationDispatched extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly correlationId: string,
    public readonly actor: Actor,
    public readonly targetId: string,
    public readonly jobId: string,
    public readonly companyId: string,
    public readonly evidenceReference: EvidenceReference | null,
  ) {
    super();
  }
}
