import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { ExecutionPlan } from '../../../dispatcher/domain/execution-plan';
import { Recommendation } from '../recommendation';

export const RECOMMENDATION_ENGINE_PORT = Symbol('RECOMMENDATION_ENGINE_PORT');

/** The stable port downstream Phase 4 modules (Decision Intelligence) depend on, rather than the
 * concrete RecommendationEngineService — mirrors ExecutionEventRecorder's port/token pattern. */
export interface RecommendationEnginePort {
  generateRecommendationsByCampaign(): Promise<
    Array<{ campaign: Campaign; executionPlan: ExecutionPlan; recommendations: Recommendation[]; correlationId: string }>
  >;
}
