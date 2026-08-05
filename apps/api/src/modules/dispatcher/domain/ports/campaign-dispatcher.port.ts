import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { ExecutionPlan } from '../execution-plan';

export const CAMPAIGN_DISPATCHER_PORT = Symbol('CAMPAIGN_DISPATCHER_PORT');

/** The stable port downstream Phase 4 modules (Recommendations) depend on, rather than the
 * concrete CampaignDispatcherService — mirrors ExecutionEventRecorder's port/token pattern. */
export interface CampaignDispatcherPort {
  buildExecutionPlansWithEntities(): Promise<Array<{ plan: ExecutionPlan; campaign: Campaign }>>;
}
