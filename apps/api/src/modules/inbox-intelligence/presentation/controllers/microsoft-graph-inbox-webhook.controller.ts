import { timingSafeEqual } from 'node:crypto';
import { Body, Controller, Inject, Logger, Post, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ConnectedMailboxRepository, CONNECTED_MAILBOX_REPOSITORY } from '../../../connected-mailbox/domain/ports/connected-mailbox.repository';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { InboxWatchRepository, INBOX_WATCH_REPOSITORY } from '../../domain/ports/inbox-watch.repository';
import { InboxChangePollingService } from '../../application/services/inbox-change-polling.service';

interface GraphChangeNotification {
  subscriptionId?: string;
  clientState?: string;
}

interface GraphNotificationEnvelope {
  value?: GraphChangeNotification[];
}

/** Same constant-time comparison as `GmailInboxWebhookController`'s own `safeEqual` — a plain
 * `!==` string comparison on a shared secret is a real, if narrow, timing side-channel; both
 * provider webhooks authenticate a secret the same way rather than one being weaker than the other. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * M29 Phase 5/21 — the real Microsoft Graph subscription notification target. Two real, distinct
 * behaviors on the SAME route, matching Graph's own documented contract:
 *
 * 1. Subscription validation handshake: when a subscription is first created (or renewed against
 *    a new/changed URL), Graph immediately POSTs here with a `validationToken` query parameter
 *    and expects the EXACT decoded token echoed back as `text/plain` within 10 seconds — no other
 *    processing happens on this request.
 * 2. Real change notifications: a JSON body with one or more `{subscriptionId, clientState}`
 *    entries. Authenticity is `clientState` — a real, random, per-deployment secret this
 *    application set at subscription-creation time, echoed back verbatim by Graph on every
 *    notification (Phase 21: "provider authenticity checks") — checked before ANY processing; a
 *    mismatch is silently ignored per-entry, never revealing whether the `subscriptionId` was
 *    otherwise valid.
 */
@ApiExcludeController()
@Controller('inbox-webhooks/microsoft')
export class MicrosoftGraphInboxWebhookController {
  private readonly logger = new Logger(MicrosoftGraphInboxWebhookController.name);

  constructor(
    @Inject(CONNECTED_MAILBOX_REPOSITORY) private readonly mailboxes: ConnectedMailboxRepository,
    @Inject(INBOX_WATCH_REPOSITORY) private readonly watches: InboxWatchRepository,
    private readonly polling: InboxChangePollingService,
    private readonly audit: EmailSecurityAuditService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async receive(@Query('validationToken') validationToken: string | undefined, @Body() envelope: GraphNotificationEnvelope, @Res() res: Response): Promise<void> {
    if (validationToken) {
      // Graph's real, documented contract requires the response BODY to be EXACTLY the decoded
      // token, nothing else — the app-wide `TransformInterceptor` wraps every controller return
      // value in `{ data: ... }`, which would make this handshake fail Graph's own validation and
      // permanently prevent the subscription from ever being created. `@Res()` WITHOUT `passthrough`
      // hands Nest's own response pipeline over entirely (no interceptor, no second automatic send)
      // — with `passthrough: true` this crashed the process outright (`ERR_HTTP_HEADERS_SENT`, real
      // and caught live) because Nest still attempted its own automatic send after this one.
      res.status(200).type('text/plain').send(validationToken);
      return;
    }

    const expectedClientState = this.config.get<string>('inboxIntelligence.microsoft.webhookClientState', '');
    for (const notification of envelope.value ?? []) {
      if (!notification.subscriptionId || !expectedClientState || !notification.clientState || !safeEqual(notification.clientState, expectedClientState)) {
        this.logger.warn('Graph notification with missing subscriptionId or mismatched clientState — ignored.');
        continue;
      }

      const watch = await this.watches.findByProviderWatchId(notification.subscriptionId);
      if (!watch) {
        this.logger.warn(`Graph notification for unknown subscription "${notification.subscriptionId}" — ignored.`);
        continue;
      }
      const mailbox = await this.mailboxes.findById(watch.connectedMailboxId);
      if (!mailbox) continue;

      await this.audit.record({ eventType: 'INBOX_CHANGE_RECEIVED', userId: mailbox.userId, connectedMailboxId: mailbox.id, detail: 'Graph change notification received.' });
      await this.polling.pollMailbox(mailbox);
    }

    // `@Res()` without `passthrough` disables Nest's automatic response entirely for this handler
    // (see the validation-token branch's own comment on why) — this branch must send its own
    // response too, not just set a status code and rely on a send that will never happen.
    res.status(202).json({});
  }
}
