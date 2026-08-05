import { Module } from '@nestjs/common';
import { ExecutionModule } from '../execution/execution.module';
import { ExecutionTrackingModule } from '../execution-tracking/execution-tracking.module';
import { CampaignExecutionTaskHandlerModule } from '../execution-activation/campaign-execution-task-handler.module';
import { WorkerService } from './application/services/worker.service';

/**
 * Worker (M10, activated M26). Still NOT imported into AppModule directly — it is reached only
 * through ExecutionActivationModule, the one real caller (see that module and
 * CampaignExecutionEntryPointService). WorkerService itself is unmodified since M10: it still
 * takes the pipeline and decision it operates on as method parameters, so it has no dependency on
 * ExecutionOrchestratorModule or ExecutionRuntimeModule.
 *
 * TASK_EXECUTION_PORT is now bound via CampaignExecutionTaskHandlerModule (M26) rather than
 * EmailDeliveryModule directly — the M12/M13 EmailDeliveryExecutionService binding could only
 * ever construct a placeholder-sender/placeholder-recipient request (ExecutionTask carries no
 * real target/company/candidate reference — see the M26 architecture audit), so it was never a
 * viable default for real delivery. CampaignExecutionTaskHandlerService dispatches by
 * ExecutionStepType and, for BATCH_EXECUTION specifically, still routes through the same real
 * Provider Selection -> Email Provider abstractions EmailDeliveryExecutionService used, just with
 * genuine per-target data. EmailDeliveryExecutionService itself is untouched and still real/
 * tested; it simply isn't the active TASK_EXECUTION_PORT binding anymore. Swapping either binding
 * never requires a change to WorkerService.
 */
@Module({
  imports: [ExecutionModule, CampaignExecutionTaskHandlerModule, ExecutionTrackingModule],
  providers: [WorkerService],
  exports: [WorkerService],
})
export class WorkerModule {}
