import { CampaignStatus } from '@german-job-engine/shared-types';
import { DomainEvent } from '../../../../shared/domain';
import { Actor } from '../value-objects/actor.vo';

/**
 * Base for every Campaign lifecycle transition event. The constructor is `public` (not
 * `protected`) — `abstract` already prevents direct instantiation, and a `protected`
 * constructor here would force every trivial subclass to redeclare its own (see the same
 * fix applied to the Application Lifecycle Engine's ApplicationLifecycleEvent).
 */
export abstract class CampaignLifecycleEvent extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly correlationId: string,
    public readonly previousState: CampaignStatus | null,
    public readonly currentState: CampaignStatus,
    public readonly actor: Actor,
  ) {
    super();
  }
}
