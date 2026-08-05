import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { InboxMessageRepository, INBOX_MESSAGE_REPOSITORY } from '../../domain/ports/inbox-message.repository';

/**
 * M29 Phase 20 — configurable retention. This milestone's own confirmed decision: matched-reply
 * content is NEVER stored as a full raw body in the first place (`ReplyIngestionService` only
 * ever persists a bounded `sanitizedExcerpt`) — so retention here means pruning that excerpt after
 * the configured window, while permanently keeping: provider identifiers (needed for correlation/
 * dedup integrity even after pruning), extracted structured facts (the useful, low-risk residue —
 * "interview on 2026-03-01" carries far less personal-data risk than the sentence it was extracted
 * from), classification, and the full audit trail (`EmailSecurityAuditEvent` rows are never
 * pruned by this service — they are the minimum legal/operational audit metadata Phase 20 itself
 * says to preserve).
 */
@Injectable()
export class InboxRetentionService {
  private readonly logger = new Logger(InboxRetentionService.name);

  constructor(
    @Inject(INBOX_MESSAGE_REPOSITORY) private readonly inboxMessages: InboxMessageRepository,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly audit: EmailSecurityAuditService,
    private readonly config: ConfigService,
  ) {}

  async pruneExpiredExcerpts(batchLimit = 200): Promise<number> {
    const retentionDays = this.config.get<number>('inboxIntelligence.retention.excerptRetentionDays', 90);
    const now = this.clock.now();
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

    const expired = await this.inboxMessages.listOlderThan(cutoff, batchLimit);
    for (const message of expired) {
      await this.inboxMessages.pruneToMinimalRecord(message.id, now);
    }
    if (expired.length > 0) {
      this.logger.log(`Pruned sanitized excerpts for ${expired.length} inbox message(s) older than ${retentionDays} days.`);
    }
    return expired.length;
  }
}
