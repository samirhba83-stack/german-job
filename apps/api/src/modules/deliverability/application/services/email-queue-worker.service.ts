import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailQueueRepository, EMAIL_QUEUE_REPOSITORY } from '../../domain/ports/email-queue.repository';
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
  ) {}

  onModuleInit(): void {
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
      this.logger.error(`Email queue tick failed: ${error instanceof Error ? error.stack : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
