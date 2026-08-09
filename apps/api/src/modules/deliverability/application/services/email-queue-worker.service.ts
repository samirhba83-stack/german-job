import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailQueueRepository, EMAIL_QUEUE_REPOSITORY } from '../../domain/ports/email-queue.repository';
import { MetricsPort, METRICS_PORT } from '../../../../shared/infrastructure/observability/metrics/metrics.port';
import { EmailQueueService } from './email-queue.service';

const TICK_INTERVAL_NAME = 'email-queue-tick';

/**
 * M28 — the queue's worker coordination driver, matching `ExecutionTickDriverService`'s
 * (M26) exact, already-proven pattern: a real `@nestjs/schedule` interval, not a literal
 * external message-queue process, claims a bounded batch and processes it sequentially. Multiple
 * API instances running this same tick concurrently is safe by construction — `claimBatch()`'s
 * conditional-update claim (not this driver) is what actually prevents two instances from
 * processing the same message twice, exactly like `PostgresLeaseLock`.
 *
 * `EMAIL_QUEUE_ENABLED=false` is the real kill switch — messages can still be enqueued with the
 * flag off, they simply never get claimed/sent until it's re-enabled, which is itself a safe,
 * inspectable state (not a lost message).
 */
@Injectable()
export class EmailQueueWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailQueueWorkerService.name);
  private running = false;
  private destroyed = false;

  constructor(
    @Inject(EMAIL_QUEUE_REPOSITORY) private readonly repository: EmailQueueRepository,
    private readonly queueService: EmailQueueService,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(METRICS_PORT) private readonly metrics: MetricsPort,
  ) {}

  onModuleInit(): void {
    // M31 Phase 3/4 — the real API/Worker process split: `RUN_TICKS=false` on an API replica means
    // it never registers this (or any other) tick, matching the recommended topology's "Worker/
    // Scheduler is its own process" role. Safe by construction here regardless (this specific tick
    // was already proven safe under real multi-instance concurrency via `claimBatch()`'s own
    // conditional-claim — see this class's own doc comment) — gated anyway so an API replica never
    // does unnecessary background polling work it has no topological reason to do.
    if (!this.config.get<boolean>('app.runTicks', true)) {
      this.logger.log('RUN_TICKS=false — email queue tick not registered on this process.');
      return;
    }
    if (!this.config.get<boolean>('emailInfrastructure.queue.enabled', true)) {
      this.logger.warn('Email queue worker is disabled (EMAIL_QUEUE_ENABLED=false) — no tick interval registered.');
      return;
    }
    const intervalMs = this.config.get<number>('emailInfrastructure.queue.tickIntervalMs', 5000);
    const interval = setInterval(() => void this.tick(), intervalMs);
    this.schedulerRegistry.addInterval(TICK_INTERVAL_NAME, interval);
    this.logger.log(`Email queue tick registered every ${intervalMs}ms.`);
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    if (this.schedulerRegistry.doesExist('interval', TICK_INTERVAL_NAME)) {
      this.schedulerRegistry.deleteInterval(TICK_INTERVAL_NAME);
    }
  }

  async tick(): Promise<void> {
    if (this.destroyed || this.running) return;

    this.running = true;
    try {
      const concurrency = this.config.get<number>('emailInfrastructure.queue.concurrency', 10);
      const claimed = await this.repository.claimBatch(concurrency, this.clock.now());
      // M31.1 Phase 11 — real doc 13 "Queue depth" catalogue metric, wired through the new
      // MetricsPort seam. A real signal (claimed-per-tick is the real activity this tick performs)
      // even though nothing aggregates/alerts on it until a real vendor is chosen (Phase 11's own
      // DECISION REQUIRED) — see ConsoleMetricsAdapter's own doc comment for why this alone does
      // not constitute "operational monitoring."
      this.metrics.recordGauge('email_queue.claimed_batch_size', claimed.length);
      if (claimed.length === 0) return;

      this.logger.debug(`Claimed ${claimed.length} email message(s) for processing.`);
      // Bounded concurrency: all claimed messages this tick process in parallel (they were
      // already atomically claimed, so there's no shared mutable state between them) —
      // `concurrency` itself is the real limit, enforced by how many `claimBatch()` ever hands
      // back in one call, not by a second throttling mechanism here.
      await Promise.all(
        claimed.map((message) =>
          this.queueService.processClaimed(message).catch((error) => {
            this.logger.error(`Failed to process email message ${message.id}: ${error instanceof Error ? error.message : String(error)}`);
          }),
        ),
      );
    } catch (error) {
      this.metrics.incrementCounter('email_queue.tick_failures');
      this.logger.error(`Email queue tick failed: ${error instanceof Error ? error.stack : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
