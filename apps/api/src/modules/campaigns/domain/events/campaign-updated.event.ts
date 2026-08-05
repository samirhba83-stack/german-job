import { DomainEvent } from '../../../../shared/domain';
import { Actor } from '../value-objects/actor.vo';

/** Raised whenever `Campaign.update()` changes name, batchPlan, executionWindow, or
 * rateLimitProfile — the fields that don't already have their own dedicated event
 * (goal -> DynamicGoalAdjusted, strategy -> CampaignStrategyChanged). Mirrors
 * CompanyUpdatedEvent/JobUpdatedEvent's sibling pattern for the same "partial update" shape. */
export class CampaignUpdated extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly correlationId: string,
    public readonly actor: Actor,
    public readonly changedFields: ReadonlyArray<string>,
  ) {
    super();
  }
}
