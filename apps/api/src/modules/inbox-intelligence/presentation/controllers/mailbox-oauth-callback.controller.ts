import { Controller, Get, Inject, Param, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { MailboxConnectionService } from '../../../connected-mailbox/application/services/mailbox-connection.service';
import { OAuthTransactionRepository, OAUTH_TRANSACTION_REPOSITORY } from '../../../connected-mailbox/domain/ports/oauth-transaction.repository';
import { parseProviderSlug } from '../../../connected-mailbox/presentation/controllers/mailbox-connections.controller';
import { InboxConsentService } from '../../application/services/inbox-consent.service';

/**
 * M29 — the ONE shared OAuth callback for both send-connection (M28.6) and inbox-upgrade (M29)
 * flows. A top-level browser redirect from Google/Microsoft can only ever target ONE pre-
 * registered `redirect_uri` per provider; rather than requiring a SECOND registered URI (real
 * added production-checklist complexity), both flows share the exact same
 * `GET /mailbox-connections/callback/:provider` route, and this controller peeks the looked-up
 * `OAuthTransaction.capability` (recorded at start time, never guessed) to dispatch to the
 * correct service. Lives in `inbox-intelligence`, not `connected-mailbox`, specifically because
 * `inbox-intelligence` already depends on `connected-mailbox` and can see both services —
 * `connected-mailbox` must never depend on `inbox-intelligence` (the reverse would be a circular
 * module dependency). Deliberately does NOT consume the transaction itself (no `tryConsume` call
 * here) — that single-use enforcement stays exactly where each capability's own service already
 * does it, this controller only reads the transaction's `capability` field to route.
 */
@ApiExcludeController()
@Controller('mailbox-connections')
export class MailboxOAuthCallbackController {
  constructor(
    private readonly sendConnectionService: MailboxConnectionService,
    private readonly inboxConsentService: InboxConsentService,
    @Inject(OAUTH_TRANSACTION_REPOSITORY) private readonly transactions: OAuthTransactionRepository,
    private readonly config: ConfigService,
  ) {}

  @Get('callback/:provider')
  async callback(
    @Param('provider') providerSlug: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') providerError: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.config.get<string>('app.corsOrigin', 'http://localhost:3000');
    parseProviderSlug(providerSlug); // validates the slug; the real provider comes from the stored transaction

    if (!state) {
      res.redirect(`${frontendUrl}/settings?mailboxConnection=failed&reason=missing_state`);
      return;
    }

    // Read-only peek at which capability this attempt was for — never consumes the transaction
    // itself; each branch below performs its own full, real lookup/expiry/single-use validation.
    const transaction = await this.transactions.findByState(state);
    if (!transaction) {
      res.redirect(`${frontendUrl}/settings?mailboxConnection=failed&reason=INVALID_STATE`);
      return;
    }

    if (transaction.capability === 'READ_APPLICATION_REPLIES') {
      const result = await this.inboxConsentService.completeInboxUpgrade(state, code ?? null, providerError ?? null);
      if (result.success) {
        res.redirect(`${frontendUrl}/settings?inboxConsent=success`);
        return;
      }
      res.redirect(`${frontendUrl}/settings?inboxConsent=failed&reason=${encodeURIComponent(result.reason)}`);
      return;
    }

    const result = await this.sendConnectionService.completeConnection(state, code ?? null, providerError ?? null);
    if (result.success) {
      res.redirect(`${frontendUrl}/settings?mailboxConnection=success`);
      return;
    }
    res.redirect(`${frontendUrl}/settings?mailboxConnection=failed&reason=${encodeURIComponent(result.reason)}`);
  }
}
