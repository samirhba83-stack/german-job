import { timingSafeEqual } from 'node:crypto';
import { BadRequestException, Body, Controller, HttpCode, Inject, Logger, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ConnectedMailboxRepository, CONNECTED_MAILBOX_REPOSITORY } from '../../../connected-mailbox/domain/ports/connected-mailbox.repository';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { InboxChangePollingService } from '../../application/services/inbox-change-polling.service';

interface PubSubPushEnvelope {
  message?: { data?: string; messageId?: string; publishTime?: string };
  subscription?: string;
}

interface GmailWatchNotificationPayload {
  emailAddress?: string;
  historyId?: number | string;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * M29 Phase 5/21 — the real Gmail Cloud Pub/Sub push-subscription target. Authenticity is a real,
 * documented Google-supported alternative to full OIDC token verification: a random per-
 * deployment secret embedded in the registered push endpoint URL itself
 * (`GOOGLE_INBOX_PUSH_AUTH_AUDIENCE`... actually the query-token form below), checked with a
 * constant-time comparison before ANY processing. The notification payload itself never carries
 * message content (Google's own design) — it only says "this mailbox has new history since some
 * point," which is exactly what `InboxChangePollingService.pollMailbox()` re-derives safely from
 * the mailbox's own stored, real cursor (never trusting a client-supplied historyId directly).
 */
@ApiExcludeController()
@Controller('inbox-webhooks/gmail')
export class GmailInboxWebhookController {
  private readonly logger = new Logger(GmailInboxWebhookController.name);

  constructor(
    @Inject(CONNECTED_MAILBOX_REPOSITORY) private readonly mailboxes: ConnectedMailboxRepository,
    private readonly polling: InboxChangePollingService,
    private readonly audit: EmailSecurityAuditService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(204)
  async receive(@Query('token') token: string | undefined, @Body() envelope: PubSubPushEnvelope): Promise<void> {
    const expectedToken = this.config.get<string>('inboxIntelligence.google.pushAuthAudience', '');
    if (!expectedToken || !token || !safeEqual(token, expectedToken)) {
      throw new UnauthorizedException('Invalid or missing push authentication token.');
    }

    const rawData = envelope.message?.data;
    if (!rawData) {
      throw new BadRequestException('Missing Pub/Sub message data.');
    }

    let payload: GmailWatchNotificationPayload;
    try {
      payload = JSON.parse(Buffer.from(rawData, 'base64').toString('utf8')) as GmailWatchNotificationPayload;
    } catch {
      throw new BadRequestException('Malformed Pub/Sub message data.');
    }

    if (!payload.emailAddress) {
      throw new BadRequestException('Notification payload missing emailAddress.');
    }

    // Real cross-user-access defense: the notification only ever identifies a mailbox by its own
    // verified email address, resolved to a real ConnectedMailbox row — never trusts any other
    // client-suppliable identifier, and never processes on behalf of a mailbox this application
    // does not itself already own and track.
    const mailbox = await this.mailboxes.findByProviderAndEmailAddress('GOOGLE_GMAIL', payload.emailAddress);
    if (!mailbox) {
      this.logger.warn(`Gmail push notification for unknown mailbox "${payload.emailAddress}" — ignored.`);
      return;
    }

    await this.audit.record({ eventType: 'INBOX_CHANGE_RECEIVED', userId: mailbox.userId, connectedMailboxId: mailbox.id, detail: 'Gmail push notification received.' });
    await this.polling.pollMailbox(mailbox);
  }
}
