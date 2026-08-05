import { Module } from '@nestjs/common';
import { ExecutionTrackingModule } from '../execution-tracking/execution-tracking.module';
import { CampaignTimelineProjectionService } from './application/services/campaign-timeline-projection.service';
import { TrustCenterProjectionService } from './application/services/trust-center-projection.service';
import { DeliveryOverviewProjectionService } from './application/services/delivery-overview-projection.service';
import { RecommendationInsightsProjectionService } from './application/services/recommendation-insights-projection.service';
import { GermanyCoverageProjectionService } from './application/services/germany-coverage-projection.service';
import { RegionalProgressProjectionService } from './application/services/regional-progress-projection.service';

/**
 * Mission Control & Decision Intelligence Center scaffold (M17). Not
 * imported into AppModule — same rule as every Phase 4 module before it.
 * Imports only ExecutionTrackingModule: this module is a strictly read-only
 * subsystem that consumes ExecutionEventQueryService exclusively, never
 * executes business logic, never modifies execution state, never sends
 * anything, and never reaches into any other bounded context (Campaigns,
 * Companies, Jobs, ...) — every projection here is computed purely from
 * persisted execution events. No presentation layer yet (no controller):
 * the actual Mission Control UI/API surface is a future milestone's
 * responsibility, matching how every prior Phase 4 engine shipped its
 * backend capability before any consumer was wired to it.
 */
@Module({
  imports: [ExecutionTrackingModule],
  providers: [
    CampaignTimelineProjectionService,
    TrustCenterProjectionService,
    DeliveryOverviewProjectionService,
    RecommendationInsightsProjectionService,
    GermanyCoverageProjectionService,
    RegionalProgressProjectionService,
  ],
  exports: [
    CampaignTimelineProjectionService,
    TrustCenterProjectionService,
    DeliveryOverviewProjectionService,
    RecommendationInsightsProjectionService,
    GermanyCoverageProjectionService,
    RegionalProgressProjectionService,
  ],
})
export class MissionControlModule {}
