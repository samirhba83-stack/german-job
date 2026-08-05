import { Module } from '@nestjs/common';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { ExecutionModule } from '../execution/execution.module';
import { CampaignDispatcherService } from './application/services/campaign-dispatcher.service';
import { DISPATCHER_CONFIG, DEFAULT_DISPATCHER_CONFIG } from './domain/dispatcher-config';
import { BATCH_SIZING_STRATEGY } from './domain/ports/batch-sizing-strategy.port';
import { INBOX_PROTECTION_STRATEGY } from './domain/ports/inbox-protection-strategy.port';
import { INTELLIGENT_TIMING_STRATEGY } from './domain/ports/intelligent-timing-strategy.port';
import { DELIVERY_CONFIDENCE_STRATEGY } from './domain/ports/delivery-confidence-strategy.port';
import { COMPANY_DISPATCH_STRATEGY } from './domain/ports/company-dispatch-strategy.port';
import { ATTACHMENT_SELECTION_STRATEGY } from './domain/ports/attachment-selection-strategy.port';
import { RETRY_ELIGIBILITY_POLICY } from './domain/ports/retry-eligibility.port';
import { AdaptiveBatchSizePolicy } from './domain/policies/adaptive-batch-size.policy';
import { InboxProtectionPolicy } from './domain/policies/inbox-protection.policy';
import { IntelligentTimingPolicy } from './domain/policies/intelligent-timing.policy';
import { DeliveryConfidencePolicy } from './domain/policies/delivery-confidence.policy';
import { DefaultCompanyDispatchStrategy } from './domain/strategies/default-company-dispatch.strategy';
import { DefaultAttachmentSelectionStrategy } from './domain/strategies/default-attachment-selection.strategy';
import { AttemptCountRetryEligibilityPolicy } from './domain/strategies/attempt-count-retry-eligibility.policy';
import { CAMPAIGN_DISPATCHER_PORT } from './domain/ports/campaign-dispatcher.port';

/**
 * Dispatcher scaffold (M4). Deliberately NOT imported into AppModule — same rule as
 * ExecutionModule (M2) and SchedulerModule (M3): this module only computes execution plans, it
 * dispatches nothing, and no SMTP/send provider exists yet to act on its output.
 *
 * Every policy/strategy/scoring algorithm is bound behind its own DI token (Phase 4 architecture
 * review) — CampaignDispatcherService depends only on the port interfaces, never a concrete
 * class, so any binding here can be swapped for a smarter implementation later without touching
 * the service. COMPANY_DISPATCH_STRATEGY, ATTACHMENT_SELECTION_STRATEGY, and
 * RETRY_ELIGIBILITY_POLICY are provided so a future milestone can inject them immediately, but
 * CampaignDispatcherService does not consume them yet — see each port's own doc comment for why.
 */
@Module({
  imports: [SchedulerModule, ExecutionModule],
  providers: [
    CampaignDispatcherService,
    { provide: DISPATCHER_CONFIG, useValue: DEFAULT_DISPATCHER_CONFIG },
    { provide: BATCH_SIZING_STRATEGY, useClass: AdaptiveBatchSizePolicy },
    { provide: INBOX_PROTECTION_STRATEGY, useClass: InboxProtectionPolicy },
    { provide: INTELLIGENT_TIMING_STRATEGY, useClass: IntelligentTimingPolicy },
    { provide: DELIVERY_CONFIDENCE_STRATEGY, useClass: DeliveryConfidencePolicy },
    { provide: COMPANY_DISPATCH_STRATEGY, useClass: DefaultCompanyDispatchStrategy },
    { provide: ATTACHMENT_SELECTION_STRATEGY, useClass: DefaultAttachmentSelectionStrategy },
    { provide: RETRY_ELIGIBILITY_POLICY, useClass: AttemptCountRetryEligibilityPolicy },
    { provide: CAMPAIGN_DISPATCHER_PORT, useExisting: CampaignDispatcherService },
  ],
  exports: [
    CampaignDispatcherService,
    DISPATCHER_CONFIG,
    COMPANY_DISPATCH_STRATEGY,
    ATTACHMENT_SELECTION_STRATEGY,
    RETRY_ELIGIBILITY_POLICY,
    CAMPAIGN_DISPATCHER_PORT,
  ],
})
export class DispatcherModule {}
