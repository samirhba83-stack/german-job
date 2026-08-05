import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConnectedMailboxRepository, CONNECTED_MAILBOX_REPOSITORY } from '../../../connected-mailbox/domain/ports/connected-mailbox.repository';
import { ConnectedMailboxRecord } from '../../../connected-mailbox/domain/models/connected-mailbox';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { InboxWatchRepository, INBOX_WATCH_REPOSITORY } from '../../domain/ports/inbox-watch.repository';
import { ConnectedInboxProviderPort, CONNECTED_INBOX_PROVIDERS } from '../../domain/ports/connected-inbox-provider.port';
import { InboxWatchRecord } from '../../domain/models/inbox-watch';
import { InboxAccessTokenService } from './inbox-access-token.service';

/**
 * M29 Phase 5 — the one place a real provider-native watch/subscription is ever registered,
 * renewed, or stopped. Failures here NEVER touch a mailbox's send-capability fields — only
 * `inboxWatch`/`inboxFailureCategory`-adjacent state.
 */
@Injectable()
export class InboxWatchService {
  private readonly logger = new Logger(InboxWatchService.name);

  constructor(
    @Inject(CONNECTED_MAILBOX_REPOSITORY) private readonly mailboxes: ConnectedMailboxRepository,
    @Inject(INBOX_WATCH_REPOSITORY) private readonly watches: InboxWatchRepository,
    @Inject(CONNECTED_INBOX_PROVIDERS) private readonly inboxProviders: ConnectedInboxProviderPort[],
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly accessTokens: InboxAccessTokenService,
    private readonly audit: EmailSecurityAuditService,
  ) {}

  private resolveProvider(mailbox: ConnectedMailboxRecord): ConnectedInboxProviderPort {
    const adapter = this.inboxProviders.find((p) => p.provider === mailbox.provider);
    if (!adapter) {
      throw new Error(`No connected-inbox provider adapter registered for "${mailbox.provider}".`);
    }
    return adapter;
  }

  async registerWatch(mailbox: ConnectedMailboxRecord): Promise<InboxWatchRecord> {
    const now = this.clock.now();
    const adapter = this.resolveProvider(mailbox);
    const accessToken = await this.accessTokens.getValidAccessToken(mailbox);

    try {
      const result = await adapter.registerWatch(accessToken, mailbox.emailAddress);
      const watch = await this.watches.upsert({ connectedMailboxId: mailbox.id, provider: mailbox.provider, providerWatchId: result.providerWatchId, historyCursor: result.historyCursor, expiresAt: result.expiresAt }, now);
      await this.audit.record({ eventType: 'INBOX_WATCH_REGISTERED', connectedMailboxId: mailbox.id, userId: mailbox.userId, detail: `Watch registered, expires ${result.expiresAt.toISOString()}.` });
      return watch;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.audit.record({ eventType: 'INBOX_WATCH_FAILED', connectedMailboxId: mailbox.id, userId: mailbox.userId, detail: message });
      throw error;
    }
  }

  async renewWatch(watch: InboxWatchRecord, mailbox: ConnectedMailboxRecord): Promise<InboxWatchRecord> {
    const now = this.clock.now();
    const adapter = this.resolveProvider(mailbox);
    const accessToken = await this.accessTokens.getValidAccessToken(mailbox);

    try {
      const result = await adapter.renewWatch(accessToken, mailbox.emailAddress, watch.providerWatchId);
      const updated = await this.watches.update(watch.id, { status: 'ACTIVE', providerWatchId: result.providerWatchId, expiresAt: result.expiresAt, lastRenewedAt: now, consecutiveFailureCount: 0, lastFailureReason: null }, now);
      await this.audit.record({ eventType: 'INBOX_WATCH_RENEWED', connectedMailboxId: mailbox.id, userId: mailbox.userId, detail: `Renewed, new expiry ${result.expiresAt.toISOString()}.` });
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const updated = await this.watches.update(watch.id, { consecutiveFailureCount: watch.consecutiveFailureCount + 1, lastFailureReason: message, ...(watch.consecutiveFailureCount + 1 >= 3 ? { status: 'FAILED' as const } : {}) }, now);
      await this.audit.record({ eventType: 'INBOX_WATCH_FAILED', connectedMailboxId: mailbox.id, userId: mailbox.userId, detail: message });
      this.logger.warn(`Inbox watch renewal failed for mailbox "${mailbox.id}" (attempt ${updated.consecutiveFailureCount}): ${message}`);
      return updated;
    }
  }

  async stopWatch(mailbox: ConnectedMailboxRecord): Promise<void> {
    const now = this.clock.now();
    const watch = await this.watches.findByConnectedMailboxId(mailbox.id);
    if (!watch) return;

    try {
      const accessToken = await this.accessTokens.getValidAccessToken(mailbox);
      const adapter = this.resolveProvider(mailbox);
      await adapter.stopWatch(accessToken, watch.providerWatchId);
    } catch (error) {
      this.logger.warn(`Best-effort provider stop-watch call failed for mailbox "${mailbox.id}": ${error instanceof Error ? error.message : String(error)}`);
    }
    await this.watches.update(watch.id, { status: 'STOPPED' }, now);
  }

  /** M29 Phase 5 renewal job — every watch expiring within the horizon. */
  async listWatchesNeedingRenewal(withinHours: number, limit: number): Promise<InboxWatchRecord[]> {
    const now = this.clock.now();
    const cutoff = new Date(now.getTime() + withinHours * 60 * 60 * 1000);
    return this.watches.listExpiringBefore(cutoff, limit);
  }
}
