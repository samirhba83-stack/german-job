import { DomainEvent } from '../../../../shared/domain';
import { Actor } from '../value-objects/actor.vo';
import { CampaignReason } from '../value-objects/campaign-reason.vo';

/** M30 Phase 3/5 — distinct from `ApplicationSkipped`: an exclusion is a deliberate, informed
 * decision (the target's application already has an active follow-up-suppression control), never
 * an operational failure or a generic skip. Kept as its own event so Mission Control / the
 * Campaign Workspace can tell "we chose not to contact this company because they already replied"
 * apart from "something went wrong trying to contact them." */
export class ApplicationExcluded extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly correlationId: string,
    public readonly actor: Actor,
    public readonly targetId: string,
    public readonly reason: CampaignReason,
  ) {
    super();
  }
}
