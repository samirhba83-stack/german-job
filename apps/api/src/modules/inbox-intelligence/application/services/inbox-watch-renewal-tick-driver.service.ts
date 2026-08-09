import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConnectedMailboxRepository, CONNECTED_MAILBOX_REPOSITORY } from '../../../connected-mailbox/domain/ports/connected-mailbox.repository';
import { InboxWatchService } from './inbox-watch.service';

const TICK_INTERVAL_NAME = 'inbox-watch-renewal-tick';

/**
 * M29 Phase 5 — real watch/subscription renewal, matching `EmailQueueWorkerService`'s established
 * driver pattern. Gmail watches last ~7 days, Graph mail subscriptions ~3 days — both expire far
 * sooner than never, so this MUST run regularly in any real deployment or inbox reading silently
 * goes stale (no error, just no more notifications) after expiry.
 */
@Injectable()
export class InboxWatchRenewalTickDriverService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InboxWatchRenewalTickDriverService.name);
  private running = false;
  private destroyed = false;

  constructor(
    @Inject(CONNECTED_MAILBOX_REPOSITORY) private readonly mailboxes: ConnectedMailboxRepository,
    private readonly watches: InboxWatchService,
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    // M31 Phase 3/4 — real API/Worker process split; see `EmailQueueWorkerService`'s identical gate.
    // Same "no cross-process lock of its own" reasoning as `InboxPollingTickDriverService` — this
    // gate is the real protection against two instances renewing the same watch concurrently.
    if (!this.config.get<boolean>('app.runTicks', true)) {
      this.logger.log('RUN_TICKS=false — inbox watch-renewal tick not registered on this process.');
      return;
    }
    if (!this.config.get<boolean>('inboxIntelligence.connectedInboxProcessingEnabled', false)) {
      this.logger.warn('Inbox processing is disabled (CONNECTED_INBOX_PROCESSING_ENABLED=false) — no watch-renewal tick registered.');
      return;
    }
    const intervalMs = this.config.get<number>('inboxIntelligence.watch.renewalTickIntervalMs', 60 * 60 * 1000);
    const interval = setInterval(() => void this.tick(), intervalMs);
    this.schedulerRegistry.addInterval(TICK_INTERVAL_NAME, interval);
    this.logger.log(`Inbox watch-renewal tick registered every ${intervalMs}ms.`);
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
      const horizonHours = this.config.get<number>('inboxIntelligence.watch.renewalHorizonHours', 24);
      const expiring = await this.watches.listWatchesNeedingRenewal(horizonHours, 50);
      for (const watch of expiring) {
        const mailbox = await this.mailboxes.findById(watch.connectedMailboxId);
        if (!mailbox || mailbox.inboxCapabilityStatus !== 'ACTIVE') continue;
        await this.watches.renewWatch(watch, mailbox);
      }
    } catch (error) {
      this.logger.error(`Inbox watch-renewal tick failed: ${error instanceof Error ? error.stack : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
