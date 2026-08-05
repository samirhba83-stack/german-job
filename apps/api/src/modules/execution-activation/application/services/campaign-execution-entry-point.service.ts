import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { CampaignStatus } from '@german-job-engine/shared-types';
import { CAMPAIGN_REPOSITORY, CampaignRepository } from '../../../campaigns/domain/repositories/campaign.repository.interface';
import { Actor } from '../../../campaigns/domain/value-objects/actor.vo';
import { CorrelationId } from '../../../campaigns/domain/value-objects/correlation-id.vo';
import { DISTRIBUTED_LOCK, DistributedLock } from '../../../execution/domain/ports/distributed-lock.port';
import { EXECUTION_CLOCK, ExecutionClock } from '../../../execution/domain/ports/execution-clock.port';
import { EXECUTION_ORCHESTRATOR_PORT, ExecutionOrchestratorPort } from '../../../execution-orchestrator/domain/ports/execution-orchestrator.port';
import { TASK_SELECTION_STRATEGY, TaskSelectionStrategy } from '../../../execution-runtime/domain/ports/task-selection-strategy.port';
import { WorkerService } from '../../../worker/application/services/worker.service';
import { TaskAlreadyExecutedException } from '../../../worker/domain/exceptions/task-already-executed.exception';
import { ExecutionEventRecorder, EXECUTION_EVENT_RECORDER } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';
import { EMPTY_BUSINESS_CONTEXT } from '../../../execution-tracking/domain/models/business-context';
import { PipelineHydrationService } from './pipeline-hydration.service';
import { CampaignExecutionCallContextHolder } from './campaign-execution-call-context';

export type ActivationOutcome =
  | { readonly status: 'NOT_RUNNING' | 'LOCKED' | 'NO_WORK' | 'WAITING_COOLDOWN' }
  | { readonly status: 'EXECUTED'; readonly taskId: string; readonly taskStatus: 'COMPLETED' | 'FAILED' }
  | { readonly status: 'ALREADY_EXECUTED' };

/**
 * M26 Phase 2 — the one authoritative application-level entry point. Every real trigger (the
 * lifecycle event listener on CampaignTransitioned-to-RUNNING, and the interval tick driver)
 * calls only this; neither reproduces its logic. One call = at most one real task advanced for
 * one campaign, guarded end to end:
 *
 *  1. Loads the campaign via the same real, ownership-scoped CampaignRepository every other
 *     command handler uses.
 *  2. Confirms it is still RUNNING (a real status re-check — eligibility can change between when
 *     a caller decided to activate this campaign and when the lock is actually acquired).
 *  3. Acquires the real Postgres-backed distributed lock (PostgresLeaseLock) — a second
 *     concurrent activate() call for the same campaign (another tick, another server instance)
 *     gets LOCKED and does nothing, never duplicate work. Campaign's own optimistic-concurrency
 *     `version` column is the actual safety net for the save() below regardless (see the lock
 *     port's own doc comment) — this lock exists purely to avoid redundant work, not as the sole
 *     correctness guarantee.
 *  4. Regenerates this campaign's pipeline through the real, unmodified Scheduler -> Dispatcher
 *     -> Recommendations -> Decision Intelligence -> Execution Planning -> Execution Orchestrator
 *     chain, then hydrates it against real ExecutionEvent history (PipelineHydrationService) so
 *     it reflects genuine prior progress rather than starting over.
 *  5. Asks the real TaskSelectionStrategy which task (if any) is next.
 *  6. Runs it through the real, unmodified WorkerService — which itself refuses to repeat an
 *     already-succeeded task (its own idempotency guard) and records a real TASK_EXECUTED event
 *     either way.
 *  7. Persists whatever the task's real domain calls did to the Campaign aggregate and publishes
 *     its domain events, exactly like every other command handler's saveAndPublish.
 *  8. Releases the lock, always, via try/finally.
 */
@Injectable()
export class CampaignExecutionEntryPointService {
  private readonly logger = new Logger(CampaignExecutionEntryPointService.name);

  constructor(
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepository: CampaignRepository,
    @Inject(DISTRIBUTED_LOCK) private readonly lock: DistributedLock,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    @Inject(EXECUTION_ORCHESTRATOR_PORT) private readonly orchestrator: ExecutionOrchestratorPort,
    @Inject(TASK_SELECTION_STRATEGY) private readonly taskSelectionStrategy: TaskSelectionStrategy,
    private readonly pipelineHydration: PipelineHydrationService,
    private readonly workerService: WorkerService,
    private readonly callContext: CampaignExecutionCallContextHolder,
    private readonly config: ConfigService,
    @Inject(EXECUTION_EVENT_RECORDER) private readonly eventRecorder: ExecutionEventRecorder,
    private readonly eventBus: EventBus,
  ) {}

  async activate(campaignId: string): Promise<ActivationOutcome> {
    const preLockCheck = await this.campaignRepository.findById(campaignId);
    if (!preLockCheck || preLockCheck.status !== CampaignStatus.RUNNING) {
      return { status: 'NOT_RUNNING' };
    }

    const lockTtlMs = this.config.get<number>('executionActivation.lockTtlMs', 60000);
    const lease = await this.lock.acquire(`campaign-execution:${campaignId}`, lockTtlMs);
    if (!lease) {
      return { status: 'LOCKED' };
    }

    try {
      return await this.activateLocked(campaignId);
    } finally {
      await lease.release();
    }
  }

  /** Loads the campaign exactly once, holding the distributed lock for the remainder — no other
   * activate() call for this same campaignId can be concurrently mutating it while this lock is
   * held, so there is no re-read-before-mutate staleness window to guard against here (unlike a
   * bare HTTP command handler, which never holds a lock across its whole execution). */
  private async activateLocked(campaignId: string): Promise<ActivationOutcome> {
    const now = this.clock.now();

    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign || campaign.status !== CampaignStatus.RUNNING) {
      return { status: 'NOT_RUNNING' };
    }

    const pipelines = await this.orchestrator.generatePipelines();
    const pipeline = pipelines.find((candidate) => candidate.campaignId === campaignId);
    if (!pipeline || pipeline.status !== 'ACTIVE') {
      return { status: 'NO_WORK' };
    }

    await this.pipelineHydration.hydrate(pipeline);
    if (pipeline.status !== 'ACTIVE') {
      return { status: 'NO_WORK' };
    }

    const decision = this.taskSelectionStrategy.select(pipeline);
    if (!decision.selectedTaskId) {
      return { status: 'NO_WORK' };
    }

    const task = pipeline.findTask(decision.selectedTaskId);
    if (!task) {
      return { status: 'NO_WORK' };
    }

    if (task.type === 'COOLDOWN' && !this.cooldownElapsed(pipeline, task.id, campaign, now)) {
      return { status: 'WAITING_COOLDOWN' };
    }

    const actor = Actor.automation('execution-activation');
    const correlationId = CorrelationId.create(pipeline.correlationId);

    try {
      const result = await this.callContext.withContext({ campaign, actor, correlationId, now }, () =>
        this.workerService.execute(pipeline, decision),
      );

      await this.campaignRepository.save(campaign);
      campaign.domainEvents.forEach((event) => this.eventBus.publish(event));
      campaign.clearDomainEvents();

      return { status: 'EXECUTED', taskId: task.id, taskStatus: result.status };
    } catch (error) {
      if (error instanceof TaskAlreadyExecutedException) {
        // Benign race: hydration and WorkerService's own guard both key off the same real event
        // log, but a concurrent tick (different process, lock renewed after this one started)
        // could still close this narrow window. Not a failure — nothing to do this cycle.
        return { status: 'ALREADY_EXECUTED' };
      }
      await this.eventRecorder.record({
        eventType: 'CAMPAIGN_EXECUTION_REJECTED',
        campaignId,
        executionId: task.id,
        correlationId: correlationId.value,
        traceId: task.id,
        summary: 'Execution activation failed unexpectedly',
        explanation: error instanceof Error ? error.message : 'Unknown error during execution activation.',
        status: 'FAILURE',
        metadata: {},
        businessContext: EMPTY_BUSINESS_CONTEXT,
      });
      this.logger.error(`Execution activation failed for campaign ${campaignId}: ${error instanceof Error ? error.stack : String(error)}`);
      throw error;
    }
  }

  /**
   * A blueprint COOLDOWN step is a pure inter-batch pacing gate, deliberately distinct from
   * Campaign's own real COOLING_DOWN status (Campaign.enterCooldown() — reserved for a genuinely
   * different, longer-lived concept: a real fatigue/risk-triggered pause requiring explicit
   * resume, see campaign.entity.ts). Calling enterCooldown() once per blueprint batch would
   * strand the campaign requiring manual resume after every single batch, defeating the whole
   * "N batches per execution-plan run" design — so this gate is timing-only and never touches
   * Campaign's status. It reuses Campaign's own real, already-persisted `checkpoint.savedAt`
   * (set by the HEALTH_CHECKPOINT step immediately preceding every COOLDOWN step in this
   * blueprint's linear chain — see DeterministicExecutionPlanningStrategy) rather than adding a
   * new timestamp field anywhere.
   */
  private cooldownElapsed(
    pipeline: { basedOn: { cooldownPlan: { entries: ReadonlyArray<{ stepId: string; durationMs: number }> } } },
    stepId: string,
    campaign: { checkpoint: { savedAt: Date } | null },
    now: Date,
  ): boolean {
    const entry = pipeline.basedOn.cooldownPlan.entries.find((candidate) => candidate.stepId === stepId);
    if (!entry || !campaign.checkpoint) {
      // No checkpoint yet is a state the dependency chain (HEALTH_CHECKPOINT always precedes
      // COOLDOWN) should make unreachable — favor making progress over an indefinite stall.
      return true;
    }
    return now.getTime() - campaign.checkpoint.savedAt.getTime() >= entry.durationMs;
  }
}
