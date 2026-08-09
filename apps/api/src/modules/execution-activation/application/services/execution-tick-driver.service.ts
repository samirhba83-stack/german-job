import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CAMPAIGN_SCHEDULER_PORT, CampaignSchedulerPort } from '../../../scheduler/domain/ports/campaign-scheduler.port';
import { CampaignExecutionEntryPointService } from './campaign-execution-entry-point.service';

const TICK_INTERVAL_NAME = 'execution-activation-tick';

/**
 * M26 Phase 5 — the queue/worker activation driver this codebase never had (the audit found:
 * no `@Cron`/`@Interval`/queue processor anywhere; `InMemoryExecutionQueue` exists but nothing
 * ever fed or drained it). Rather than force-fit a literal message-queue abstraction onto a
 * pull/recompute-based pipeline (every service from Scheduler through ExecutionRuntime
 * regenerates its output fresh on each call — see the M26 architecture audit), this is a real
 * NestJS interval tick: each tick asks the real, unmodified Scheduler for every currently
 * eligible campaign, then calls CampaignExecutionEntryPointService.activate() once per campaign.
 * The entry point's own distributed lock (per campaignId) is what actually prevents two ticks —
 * or a tick overlapping the lifecycle-event "kick" — from working the same campaign concurrently;
 * this driver does no locking of its own, it only decides *when* and *for whom* to call the one
 * real entry point, matching "the controller/scheduler must call this application entry point;
 * they must not reproduce its business logic."
 *
 * Ticks run sequentially per campaign within one interval firing (not Promise.all) — bounded
 * concurrency and simple campaign-level fairness (one task attempt per campaign per tick, in
 * scheduler-priority order) without needing a separate concurrency-limiting mechanism.
 *
 * `executionActivation.enabled` (config) is the real kill switch — set
 * EXECUTION_ACTIVATION_ENABLED=false to stop all automatic activation without touching code.
 */
@Injectable()
export class ExecutionTickDriverService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExecutionTickDriverService.name);
  private running = false;
  private destroyed = false;

  constructor(
    @Inject(CAMPAIGN_SCHEDULER_PORT) private readonly scheduler: CampaignSchedulerPort,
    private readonly entryPoint: CampaignExecutionEntryPointService,
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    // M31 Phase 3/4 — real API/Worker process split; see `EmailQueueWorkerService`'s identical gate
    // for the full reasoning. This tick's own per-campaign work is separately safe under real
    // multi-instance concurrency (the entry point's Postgres distributed lock), so this gate exists
    // for topological cleanliness, not correctness.
    if (!this.config.get<boolean>('app.runTicks', true)) {
      this.logger.log('RUN_TICKS=false — execution activation tick not registered on this process.');
      return;
    }
    if (!this.config.get<boolean>('executionActivation.enabled', true)) {
      this.logger.warn('Execution activation is disabled (EXECUTION_ACTIVATION_ENABLED=false) — no tick interval registered.');
      return;
    }
    const intervalMs = this.config.get<number>('executionActivation.tickIntervalMs', 30000);
    const interval = setInterval(() => void this.tick(), intervalMs);
    this.schedulerRegistry.addInterval(TICK_INTERVAL_NAME, interval);
    this.logger.log(`Execution activation tick registered every ${intervalMs}ms.`);
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    if (this.schedulerRegistry.doesExist('interval', TICK_INTERVAL_NAME)) {
      this.schedulerRegistry.deleteInterval(TICK_INTERVAL_NAME);
    }
  }

  async tick(): Promise<void> {
    if (this.destroyed || this.running || !this.config.get<boolean>('executionActivation.enabled', true)) {
      return;
    }

    this.running = true;
    try {
      const eligible = await this.scheduler.getEligibleCampaignsWithEntities();
      for (const { campaign } of eligible) {
        if (this.destroyed) {
          break;
        }
        try {
          await this.entryPoint.activate(campaign.id);
        } catch (error) {
          // One campaign's failure must never stop the tick from reaching the rest — logged and
          // recorded (by the entry point itself) rather than silently swallowed.
          this.logger.error(`Tick failed for campaign ${campaign.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      this.logger.error(`Execution tick failed: ${error instanceof Error ? error.stack : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
