import { Inject, Injectable } from '@nestjs/common';
import { ExecutionTask } from '../../../execution-orchestrator/domain/entities/execution-task.entity';
import { TaskExecutionOutcome, TaskExecutionPort } from '../../../worker/domain/ports/task-execution.port';
import { ExecutionEventRecorder, EXECUTION_EVENT_RECORDER } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';
import { EMPTY_BUSINESS_CONTEXT } from '../../../execution-tracking/domain/models/business-context';
import { CampaignBatchDispatchService } from './campaign-batch-dispatch.service';
import { CampaignExecutionCallContextHolder } from './campaign-execution-call-context';

/**
 * Real TASK_EXECUTION_PORT binding for M26 — replaces EmailDeliveryExecutionService as
 * WorkerModule's default (see WorkerModule doc comment for why: ExecutionTask carries no real
 * target/company/candidate reference, so a generic "email every task" binding could never
 * correctly route BATCH_EXECUTION work). This dispatches by ExecutionStepType instead:
 *
 *  - PREPARATION / COOLDOWN: no real work of their own — preconditions were already verified by
 *    CampaignExecutionEntryPointService before the Worker was ever invoked (PREPARATION), and
 *    COOLDOWN's actual time-gating happens in the entry point too (it never selects a COOLDOWN
 *    task before its blueprint-scheduled delay has elapsed — see PipelineHydrationService). Both
 *    complete trivially here so the pipeline's own dependency graph can advance.
 *  - BATCH_EXECUTION: the real work — delegates to CampaignBatchDispatchService.
 *  - HEALTH_CHECKPOINT: closes out the batch just executed via Campaign's own real
 *    completeBatch() (partial-completion-aware, saves a real checkpoint, checks goal-reached —
 *    all pre-existing domain logic, not reimplemented here).
 *  - COMPLETION: marks this execution-plan run's own end. Deliberately does NOT call
 *    Campaign.complete() — a full campaign completion remains a distinct, deliberate action
 *    (existing /complete endpoint), not an automatic side effect of one batch-count-bounded
 *    execution cycle finishing to avoid contradicting explicit user intent (M26 Phase 3).
 *
 * Implements the real, unmodified TaskExecutionPort contract WorkerService (M10) already
 * depends on — the (campaign, actor, correlationId, now) each branch needs comes from
 * CampaignExecutionCallContextHolder (AsyncLocalStorage), populated by
 * CampaignExecutionEntryPointService around each WorkerService.execute() call, not from a
 * widened method signature — see that holder's own doc comment for why.
 */
@Injectable()
export class CampaignExecutionTaskHandlerService implements TaskExecutionPort {
  constructor(
    private readonly batchDispatch: CampaignBatchDispatchService,
    private readonly callContext: CampaignExecutionCallContextHolder,
    @Inject(EXECUTION_EVENT_RECORDER) private readonly eventRecorder: ExecutionEventRecorder,
  ) {}

  async execute(task: ExecutionTask): Promise<TaskExecutionOutcome> {
    const { campaign, actor, correlationId, now } = this.callContext.current();

    switch (task.type) {
      case 'PREPARATION':
        return { success: true, reason: 'Preconditions were already verified before this pipeline run started.', failureReason: null };

      case 'BATCH_EXECUTION': {
        const summary = await this.batchDispatch.runNextBatch(campaign, actor, correlationId, now);
        return {
          success: true,
          reason: `Batch ${summary.batchId}: ${summary.dispatched}/${summary.attempted} target(s) dispatched, ${summary.failed} failed.`,
          failureReason: null,
        };
      }

      case 'HEALTH_CHECKPOINT': {
        const lastBatch = campaign.batches[campaign.batches.length - 1];
        if (!lastBatch) {
          return { success: false, reason: 'No batch to checkpoint.', failureReason: 'HEALTH_CHECKPOINT reached with zero batches on the campaign.' };
        }
        campaign.completeBatch(lastBatch.id, actor, correlationId);
        return { success: true, reason: `Checkpoint saved for batch ${lastBatch.id}.`, failureReason: null };
      }

      case 'COOLDOWN':
        return { success: true, reason: 'Cooldown window elapsed; continuing.', failureReason: null };

      case 'COMPLETION':
        await this.eventRecorder.record({
          eventType: 'CAMPAIGN_EXECUTION_COMPLETED',
          campaignId: campaign.id,
          executionId: task.id,
          correlationId: correlationId.value,
          traceId: task.id,
          summary: 'Execution plan run completed',
          explanation: 'This execution-plan run reached its final step. The campaign remains RUNNING; the Scheduler will re-evaluate it for further work on the next eligible tick.',
          status: 'SUCCESS',
          metadata: {},
          businessContext: { ...EMPTY_BUSINESS_CONTEXT, userId: campaign.ownerId },
        });
        return { success: true, reason: 'Execution plan run completed.', failureReason: null };

      default:
        return { success: false, reason: 'Unknown step type.', failureReason: `Unrecognized ExecutionStepType: ${task.type as string}` };
    }
  }
}
