import { Injectable } from '@nestjs/common';
import { ExecutionEventQueryService } from '../../../execution-tracking/application/services/execution-event-query.service';
import { CampaignTimelineEntry } from '../../domain/models/campaign-timeline-entry';

/**
 * Live Execution Timeline (M17). Read-only: consumes ExecutionEventQueryService
 * exclusively, never executes business logic, never touches infrastructure.
 */
@Injectable()
export class CampaignTimelineProjectionService {
  constructor(private readonly eventQuery: ExecutionEventQueryService) {}

  async getTimeline(campaignId: string): Promise<CampaignTimelineEntry[]> {
    const events = await this.eventQuery.findByCampaignId(campaignId);

    return events.map((event) => ({
      timestamp: event.occurredAt,
      eventType: event.eventType,
      executionId: event.executionId,
      campaignId: event.campaignId,
      correlationId: event.correlationId,
      traceId: event.traceId,
      explanation: event.explanation,
      status: event.status,
      metadata: event.metadata,
      businessContext: event.businessContext,
    }));
  }
}
