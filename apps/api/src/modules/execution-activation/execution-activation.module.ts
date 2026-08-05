import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { ExecutionModule } from '../execution/execution.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { ExecutionOrchestratorModule } from '../execution-orchestrator/execution-orchestrator.module';
import { ExecutionRuntimeModule } from '../execution-runtime/execution-runtime.module';
import { WorkerModule } from '../worker/worker.module';
import { ExecutionTrackingModule } from '../execution-tracking/execution-tracking.module';
import { CampaignExecutionTaskHandlerModule } from './campaign-execution-task-handler.module';
import { CampaignExecutionEntryPointService } from './application/services/campaign-execution-entry-point.service';
import { PipelineHydrationService } from './application/services/pipeline-hydration.service';
import { ExecutionTickDriverService } from './application/services/execution-tick-driver.service';
import { CampaignRunningExecutionTriggerHandler } from './application/event-handlers/campaign-running-execution-trigger.handler';

/**
 * M26 — the module that finally connects the whole real-but-previously-disconnected execution
 * pipeline the architecture audit found (`docs/execution-activation/01-architecture-audit.md`)
 * to the running application. This is the first of every module in that chain
 * (scheduler/dispatcher/recommendations/decision-intelligence/execution-planning/
 * execution-orchestrator/execution-runtime/worker/application-assembly/
 * business-policy-enforcement/provider-selection/email-provider/email-delivery/
 * execution-tracking/mission-control) to actually be imported into AppModule — every one of
 * those modules' own doc comments said "deliberately NOT imported into AppModule... a future
 * milestone" for exactly this reason.
 *
 * Owns only the NEW glue this milestone adds — CampaignExecutionEntryPointService (Phase 2),
 * PipelineHydrationService (Phase 4), ExecutionTickDriverService (Phase 5), and the lifecycle
 * event listener (Phase 3). The real per-target work (CampaignBatchDispatchService,
 * CampaignExecutionTaskHandlerService) lives in CampaignExecutionTaskHandlerModule instead,
 * imported by WorkerModule directly — not re-declared or duplicated here.
 */
@Module({
  imports: [
    CqrsModule,
    CampaignsModule,
    ExecutionModule,
    SchedulerModule,
    ExecutionOrchestratorModule,
    ExecutionRuntimeModule,
    WorkerModule,
    CampaignExecutionTaskHandlerModule,
    ExecutionTrackingModule,
  ],
  providers: [PipelineHydrationService, CampaignExecutionEntryPointService, ExecutionTickDriverService, CampaignRunningExecutionTriggerHandler],
  exports: [CampaignExecutionEntryPointService],
})
export class ExecutionActivationModule {}
