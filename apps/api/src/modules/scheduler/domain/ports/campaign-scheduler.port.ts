import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { SchedulingDecision } from '../scheduling-decision';

export const CAMPAIGN_SCHEDULER_PORT = Symbol('CAMPAIGN_SCHEDULER_PORT');

/** The stable port downstream Phase 4 modules (Dispatcher) depend on, rather than the concrete
 * CampaignSchedulerService — mirrors ExecutionEventRecorder's port/token pattern. */
export interface CampaignSchedulerPort {
  getEligibleCampaignsWithEntities(): Promise<Array<{ decision: SchedulingDecision; campaign: Campaign }>>;
}
