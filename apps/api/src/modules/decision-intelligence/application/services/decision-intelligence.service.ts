import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { RecommendationEnginePort, RECOMMENDATION_ENGINE_PORT } from '../../../recommendations/domain/ports/recommendation-engine.port';
import { DecisionAggregationStrategy, DECISION_AGGREGATION_STRATEGY } from '../../domain/ports/decision-aggregation-strategy.port';
import { DecisionReport } from '../../domain/decision-report';
import { ExecutionEventRecorder, EXECUTION_EVENT_RECORDER } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';
import { EMPTY_BUSINESS_CONTEXT } from '../../../execution-tracking/domain/models/business-context';
import { DecisionIntelligencePort } from '../../domain/ports/decision-intelligence.port';

/**
 * The orchestration layer above the Recommendation Engine (Milestone 6): aggregates every
 * campaign's independent, explainable recommendations into one coherent DecisionReport per
 * campaign. It never executes anything and has no knowledge of SMTP, queues, workers, providers,
 * APIs, or any other infrastructure — its only dependency is RecommendationEngineService and the
 * injected DecisionAggregationStrategy port. All aggregation/conflict-resolution/prioritization
 * logic lives in that strategy, not here, so replacing it (including with a future AI model)
 * never requires a change to this service.
 */
@Injectable()
export class DecisionIntelligenceService implements DecisionIntelligencePort {
  constructor(
    @Inject(RECOMMENDATION_ENGINE_PORT) private readonly recommendationEngineService: RecommendationEnginePort,
    @Inject(DECISION_AGGREGATION_STRATEGY) private readonly aggregationStrategy: DecisionAggregationStrategy,
    @Inject(EXECUTION_EVENT_RECORDER) private readonly eventRecorder: ExecutionEventRecorder,
  ) {}

  /** One DecisionReport per campaign the Recommendation Engine currently has recommendations
   * (or an empty set) for. */
  async generateDecisionReports(): Promise<DecisionReport[]> {
    const perCampaign = await this.recommendationEngineService.generateRecommendationsByCampaign();

    return Promise.all(
      perCampaign.map(async ({ campaign, recommendations, correlationId }) => {
        const draft = this.aggregationStrategy.aggregate({ campaignId: campaign.id, recommendations });
        const report: DecisionReport = { ...draft, id: randomUUID(), correlationId, userId: campaign.ownerId };

        await this.eventRecorder.record({
          eventType: 'DECISION_MADE',
          campaignId: campaign.id,
          executionId: null,
          correlationId,
          traceId: correlationId,
          summary: report.finalRecommendation ? `Decision made: ${report.finalRecommendation.reasonCode}` : 'No decision reached',
          explanation: report.explanation,
          status: report.finalRecommendation ? 'SUCCESS' : 'FAILURE',
          metadata: { confidenceScore: String(report.confidenceScore) },
          businessContext: {
            ...EMPTY_BUSINESS_CONTEXT,
            userId: campaign.ownerId,
            decisionId: report.id,
            recommendationId: report.finalRecommendation?.id ?? null,
          },
        });

        return report;
      }),
    );
  }
}
