import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExecutionModule } from '../execution/execution.module';
import { DocumentsModule } from '../documents/documents.module';
import { DeliverabilityModule } from '../deliverability/deliverability.module';
import { CONNECTED_MAILBOX_REPOSITORY } from './domain/ports/connected-mailbox.repository';
import { OAUTH_TRANSACTION_REPOSITORY } from './domain/ports/oauth-transaction.repository';
import { CONNECTED_MAILBOX_SEND_ATTEMPT_REPOSITORY } from './domain/ports/connected-mailbox-send-attempt.repository';
import { CONNECTED_MAILBOX_PROVIDERS } from './domain/ports/connected-mailbox-provider.port';
import { TOKEN_VAULT_PORT } from './domain/ports/token-vault.port';
import { PrismaConnectedMailboxRepository } from './infrastructure/persistence/prisma-connected-mailbox.repository';
import { PrismaOAuthTransactionRepository } from './infrastructure/persistence/prisma-oauth-transaction.repository';
import { PrismaConnectedMailboxSendAttemptRepository } from './infrastructure/persistence/prisma-connected-mailbox-send-attempt.repository';
import { AesGcmTokenVaultAdapter } from './infrastructure/adapters/aes-gcm-token-vault.adapter';
import { GmailMailboxProviderAdapter } from './infrastructure/adapters/gmail-mailbox-provider.adapter';
import { MicrosoftOutlookMailboxProviderAdapter } from './infrastructure/adapters/microsoft-outlook-mailbox-provider.adapter';
import { OAuthSecurityService } from './application/services/oauth-security.service';
import { MailboxTokenVaultService } from './application/services/mailbox-token-vault.service';
import { MailboxConnectionService } from './application/services/mailbox-connection.service';
import { ConnectedMailboxRateLimiterService } from './application/services/connected-mailbox-rate-limiter.service';
import { ConnectedMailboxReadinessService } from './application/services/connected-mailbox-readiness.service';
import { ConnectedMailboxSendService } from './application/services/connected-mailbox-send.service';
import { MailboxConnectionsController } from './presentation/controllers/mailbox-connections.controller';
import { AdminConnectedMailboxController } from './presentation/controllers/admin-connected-mailbox.controller';

/**
 * M28.6 — candidate application emails now send from the candidate's own connected Gmail/Outlook
 * mailbox (the "Non-Negotiable Product Decision": platform email stays reserved for account
 * notifications/invoices/system communications). Depends on `DocumentsModule` (attachment
 * resolution + the shared security audit trail) and `DeliverabilityModule` (suppression-list
 * checking — `ConnectedMailboxReadinessService` reuses `DeliverabilityService.isSuppressed()`
 * rather than duplicating it) — a one-directional dependency graph, no cycle back onto this
 * module. `CONNECTED_MAILBOX_PROVIDERS` is a DI array token (Nest has no native multi-provider
 * binding) bound via `useFactory` to both real adapters; every provider implementation must be
 * added to that factory's array to be reachable.
 *
 * Exports `ConnectedMailboxSendService` — the one thing `execution-activation`'s
 * `campaign-execution-task-handler.module.ts` needs to route candidate-application dispatch here
 * instead of the platform sender (see that module's own doc comment for the M28.6 rewire).
 *
 * M30 fix — several providers here (`AesGcmTokenVaultAdapter`, `GmailMailboxProviderAdapter`,
 * `MicrosoftOutlookMailboxProviderAdapter`, `MailboxConnectionService`,
 * `ConnectedMailboxRateLimiterService`, `ConnectedMailboxReadinessService`) inject `ConfigService`
 * directly but this module never imported `ConfigModule` (same pre-existing gap found and fixed
 * in `DocumentsModule`/`EmailProviderModule`/`BillingModule` — see their doc comments).
 */
@Module({
  imports: [ExecutionModule, DocumentsModule, DeliverabilityModule, ConfigModule],
  controllers: [MailboxConnectionsController, AdminConnectedMailboxController],
  providers: [
    { provide: CONNECTED_MAILBOX_REPOSITORY, useClass: PrismaConnectedMailboxRepository },
    { provide: OAUTH_TRANSACTION_REPOSITORY, useClass: PrismaOAuthTransactionRepository },
    { provide: CONNECTED_MAILBOX_SEND_ATTEMPT_REPOSITORY, useClass: PrismaConnectedMailboxSendAttemptRepository },
    { provide: TOKEN_VAULT_PORT, useClass: AesGcmTokenVaultAdapter },
    GmailMailboxProviderAdapter,
    MicrosoftOutlookMailboxProviderAdapter,
    {
      provide: CONNECTED_MAILBOX_PROVIDERS,
      useFactory: (gmail: GmailMailboxProviderAdapter, outlook: MicrosoftOutlookMailboxProviderAdapter) => [gmail, outlook],
      inject: [GmailMailboxProviderAdapter, MicrosoftOutlookMailboxProviderAdapter],
    },
    OAuthSecurityService,
    MailboxTokenVaultService,
    MailboxConnectionService,
    ConnectedMailboxRateLimiterService,
    ConnectedMailboxReadinessService,
    ConnectedMailboxSendService,
  ],
  // M29 — also exports OAUTH_TRANSACTION_REPOSITORY/TOKEN_VAULT_PORT/OAuthSecurityService/
  // MailboxTokenVaultService so `inbox-intelligence`'s `InboxConsentService` can reuse the exact
  // same OAuth transaction/token-vault machinery for the inbox-upgrade flow, rather than a second,
  // parallel implementation.
  exports: [
    ConnectedMailboxSendService,
    MailboxConnectionService,
    CONNECTED_MAILBOX_REPOSITORY,
    OAUTH_TRANSACTION_REPOSITORY,
    TOKEN_VAULT_PORT,
    OAuthSecurityService,
    MailboxTokenVaultService,
    CONNECTED_MAILBOX_PROVIDERS,
    CONNECTED_MAILBOX_SEND_ATTEMPT_REPOSITORY,
  ],
})
export class ConnectedMailboxModule {}
