import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConnectedMailboxRepository, CONNECTED_MAILBOX_REPOSITORY } from '../../../connected-mailbox/domain/ports/connected-mailbox.repository';
import { ConnectedMailboxRecord } from '../../../connected-mailbox/domain/models/connected-mailbox';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { InboxWatchRepository, INBOX_WATCH_REPOSITORY } from '../../domain/ports/inbox-watch.repository';
import { ConnectedInboxProviderPort, CONNECTED_INBOX_PROVIDERS } from '../../domain/ports/connected-inbox-provider.port';
import { InboxAccessTokenService } from './inbox-access-token.service';
import { ReplyIngestionService } from './reply-ingestion.service';

/**
 * M29 Phase 5 — the ONE place `fetchChangedMessages()` is ever called, shared by both real
 * provider webhook notifications (which carry no message content, only "something changed — go
 * check") and the polling tick driver (the safe deterministic fallback for local development AND
 * the real recovery mechanism after a missed notification — Phase 5's own "if local development
 * cannot receive provider webhooks, provide a safe deterministic polling adapter," satisfied by
 * reusing this exact same real code path rather than a second, fake mechanism). Idempotent by
 * construction: `ReplyIngestionService.ingestChangedMessage()` itself no-ops on an already-
 * processed `providerMessageId`, so calling this twice for an overlapping change range (a webhook
 * notification arriving right before/after a poll tick) is always safe.
 */
@Injectable()
export class InboxChangePollingService {
  private readonly logger = new Logger(InboxChangePollingService.name);

  constructor(
    @Inject(CONNECTED_MAILBOX_REPOSITORY) private readonly mailboxes: ConnectedMailboxRepository,
    @Inject(INBOX_WATCH_REPOSITORY) private readonly watches: InboxWatchRepository,
    @Inject(CONNECTED_INBOX_PROVIDERS) private readonly inboxProviders: ConnectedInboxProviderPort[],
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly accessTokens: InboxAccessTokenService,
    private readonly ingestion: ReplyIngestionService,
    private readonly audit: EmailSecurityAuditService,
  ) {}

  async pollMailbox(mailbox: ConnectedMailboxRecord): Promise<void> {
    if (mailbox.inboxCapabilityStatus !== 'ACTIVE') return;

    const watch = await this.watches.findByConnectedMailboxId(mailbox.id);
    if (!watch || !watch.historyCursor) return;

    const now = this.clock.now();
    const adapter = this.inboxProviders.find((p) => p.provider === mailbox.provider);
    if (!adapter) return;

    let accessToken: string;
    try {
      accessToken = await this.accessTokens.getValidAccessToken(mailbox);
    } catch {
      return; // already recorded INBOX_REAUTHORIZATION_REQUIRED by InboxAccessTokenService
    }

    await this.audit.record({ eventType: 'INBOX_CHANGE_RECEIVED', userId: mailbox.userId, connectedMailboxId: mailbox.id, detail: `Polling changes since cursor "${watch.historyCursor}".` });

    const result = await adapter.fetchChangedMessages(accessToken, watch.historyCursor);

    if (result.cursorTooOld) {
      // Phase 5 "gap detection... recovery polling after missed notifications": the stored cursor
      // is too old to resume from — the only safe recovery is re-establishing a fresh cursor.
      // Real messages that arrived in the un-recoverable gap are honestly missed (named in Known
      // Limitations), rather than attempting a full-mailbox backfill scan this milestone.
      this.logger.warn(`Inbox history cursor too old for mailbox "${mailbox.id}" — re-establishing a fresh cursor (a real, bounded gap may exist).`);
      const freshCursor = await adapter.fetchCurrentHistoryCursor(accessToken);
      await this.watches.update(watch.id, { historyCursor: freshCursor, lastNotificationAt: now }, now);
      return;
    }

    for (const changed of result.changedMessages) {
      try {
        await this.ingestion.ingestChangedMessage(mailbox, changed);
      } catch (error) {
        this.logger.warn(`Failed to ingest changed message "${changed.providerMessageId}" for mailbox "${mailbox.id}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    await this.watches.update(watch.id, { historyCursor: result.newHistoryCursor, lastNotificationAt: now }, now);
  }

  async pollAllActiveMailboxes(limit: number): Promise<void> {
    const activeWatches = await this.watches.listExpiringBefore(new Date(this.clock.now().getTime() + 365 * 24 * 60 * 60 * 1000), limit);
    for (const watch of activeWatches) {
      if (watch.status !== 'ACTIVE') continue;
      const mailbox = await this.mailboxes.findById(watch.connectedMailboxId);
      if (!mailbox) continue;
      await this.pollMailbox(mailbox);
    }
  }
}
