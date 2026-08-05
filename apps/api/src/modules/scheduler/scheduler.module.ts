import { Module } from '@nestjs/common';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { ExecutionModule } from '../execution/execution.module';
import { CampaignSchedulerService } from './application/services/campaign-scheduler.service';
import { ELIGIBILITY_STRATEGY } from './domain/ports/eligibility-strategy.port';
import { PRIORITY_STRATEGY } from './domain/ports/priority-strategy.port';
import { CampaignEligibilityPolicy } from './domain/policies/campaign-eligibility.policy';
import { CampaignPriorityPolicy } from './domain/policies/campaign-priority.policy';
import { SCHEDULER_CONFIG, DEFAULT_SCHEDULER_CONFIG } from './domain/scheduler-config';
import { CAMPAIGN_SCHEDULER_PORT } from './domain/ports/campaign-scheduler.port';

/**
 * Scheduler scaffold (M3). Deliberately NOT imported into AppModule — same rule as
 * ExecutionModule (M2): this module decides eligibility only, it dispatches nothing, and the
 * execution engine that would act on its decisions doesn't exist yet.
 *
 * ELIGIBILITY_STRATEGY and PRIORITY_STRATEGY are DI ports (Phase 4 architecture review) — swap
 * either binding to change scoring behavior without touching CampaignSchedulerService.
 *
 * CAMPAIGN_SCHEDULER_PORT is what downstream modules (Dispatcher) should depend on — it lets
 * this module own its own interface seam rather than a consumer reaching in for the concrete
 * class (Architecture Stabilization M24.5).
 */
@Module({
  imports: [CampaignsModule, ExecutionModule],
  providers: [
    CampaignSchedulerService,
    { provide: SCHEDULER_CONFIG, useValue: DEFAULT_SCHEDULER_CONFIG },
    { provide: ELIGIBILITY_STRATEGY, useClass: CampaignEligibilityPolicy },
    { provide: PRIORITY_STRATEGY, useClass: CampaignPriorityPolicy },
    { provide: CAMPAIGN_SCHEDULER_PORT, useExisting: CampaignSchedulerService },
  ],
  exports: [CampaignSchedulerService, SCHEDULER_CONFIG, CAMPAIGN_SCHEDULER_PORT],
})
export class SchedulerModule {}
