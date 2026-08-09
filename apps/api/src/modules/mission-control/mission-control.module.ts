import { Module } from '@nestjs/common';
import { ExecutionTrackingModule } from '../execution-tracking/execution-tracking.module';
import { InboxIntelligenceModule } from '../inbox-intelligence/inbox-intelligence.module';
import { RecruitmentOperationsModule } from '../recruitment-operations/recruitment-operations.module';
import { CampaignTimelineProjectionService } from './application/services/campaign-timeline-projection.service';
import { TrustCenterProjectionService } from './application/services/trust-center-projection.service';
import { DeliveryOverviewProjectionService } from './application/services/delivery-overview-projection.service';
import { RecommendationInsightsProjectionService } from './application/services/recommendation-insights-projection.service';
import { GermanyCoverageProjectionService } from './application/services/germany-coverage-projection.service';
import { RegionalProgressProjectionService } from './application/services/regional-progress-projection.service';
import { ReplyFollowUpProjectionService } from './application/services/reply-followup-projection.service';

/**
 * Mission Control & Decision Intelligence Center scaffold (M17). Not imported into AppModule —
 * same rule as every Phase 4 module before it; no presentation layer yet (no controller). Most
 * projections here consume `ExecutionEventQueryService` exclusively — strictly read-only, never
 * executes business logic, never modifies execution state.
 *
 * M30 Phase 11 exception, made explicit rather than silently violating the paragraph above:
 * `ReplyFollowUpProjectionService` is the one projection that reads directly from
 * `inbox-intelligence`/`recruitment-operations` repositories instead of `ExecutionEventQueryService`
 * — a reply's classification, an active follow-up control, and an open recruitment task have no
 * `ExecutionEvent` equivalent to project from (confirmed: no ExecutionEvent carries any of this
 * data). This is still real, still read-only, still computed purely from persisted state — just
 * not from the ExecutionEvent log specifically. See `reply-followup-overview.ts`'s own doc
 * comment for the full reasoning.
 */
@Module({
  imports: [ExecutionTrackingModule, InboxIntelligenceModule, RecruitmentOperationsModule],
  providers: [
    CampaignTimelineProjectionService,
    TrustCenterProjectionService,
    DeliveryOverviewProjectionService,
    RecommendationInsightsProjectionService,
    GermanyCoverageProjectionService,
    RegionalProgressProjectionService,
    ReplyFollowUpProjectionService,
  ],
  exports: [
    CampaignTimelineProjectionService,
    TrustCenterProjectionService,
    DeliveryOverviewProjectionService,
    RecommendationInsightsProjectionService,
    GermanyCoverageProjectionService,
    RegionalProgressProjectionService,
    ReplyFollowUpProjectionService,
  ],
})
export class MissionControlModule {}
