import { Injectable } from '@nestjs/common';
import { ExecutionEventQueryService } from '../../../execution-tracking/application/services/execution-event-query.service';
import { RecommendationInsight } from '../../domain/models/recommendation-insight';

const DEFAULT_LIMIT = 200;

/** Recommendation Center (M17). Real RECOMMENDATION_GENERATED events, most recent first. */
@Injectable()
export class RecommendationInsightsProjectionService {
  constructor(private readonly eventQuery: ExecutionEventQueryService) {}

  async getInsights(limit: number = DEFAULT_LIMIT): Promise<RecommendationInsight[]> {
    const events = await this.eventQuery.findByEventType('RECOMMENDATION_GENERATED', limit);

    return events.map((event) => ({
      campaignId: event.campaignId,
      timestamp: event.occurredAt,
      recommendationCount: Number(event.metadata.recommendationCount ?? '0'),
      explanation: event.explanation,
    }));
  }
}
