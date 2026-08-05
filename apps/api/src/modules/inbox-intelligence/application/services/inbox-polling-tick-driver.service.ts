import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InboxChangePollingService } from './inbox-change-polling.service';

const TICK_INTERVAL_NAME = 'inbox-polling-tick';

/**
 * M29 Phase 5 — the real "safe deterministic polling" mechanism, matching
 * `EmailQueueWorkerService`'s (M28) already-proven manual-`setInterval` + `SchedulerRegistry`
 * pattern exactly. Serves THREE roles with one real code path: the local-development fallback
 * (no public webhook endpoint needed to see inbox intelligence work end to end), the production
 * recovery mechanism after a missed provider notification, and a safety net against a webhook
 * delivery that silently failed. `INBOX_POLLING_ENABLED=false` stops future ticks; watches/
 * consent themselves are unaffected (a safe, inspectable state, not a lost message — same
 * doctrine as `EMAIL_QUEUE_ENABLED`).
 */
@Injectable()
export class InboxPollingTickDriverService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InboxPollingTickDriverService.name);
  private running = false;
  private destroyed = false;

  constructor(
    private readonly polling: InboxChangePollingService,
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    if (!this.config.get<boolean>('inboxIntelligence.polling.enabled', true)) {
      this.logger.warn('Inbox polling is disabled (INBOX_POLLING_ENABLED=false) — no tick interval registered.');
      return;
    }
    const intervalMs = this.config.get<number>('inboxIntelligence.polling.tickIntervalMs', 2 * 60 * 1000);
    const interval = setInterval(() => void this.tick(), intervalMs);
    this.schedulerRegistry.addInterval(TICK_INTERVAL_NAME, interval);
    this.logger.log(`Inbox polling tick registered every ${intervalMs}ms.`);
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
      if (!this.config.get<boolean>('inboxIntelligence.connectedInboxProcessingEnabled', false)) return;
      await this.polling.pollAllActiveMailboxes(50);
    } catch (error) {
      this.logger.error(`Inbox polling tick failed: ${error instanceof Error ? error.stack : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
