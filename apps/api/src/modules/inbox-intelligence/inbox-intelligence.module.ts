import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ExecutionModule } from '../execution/execution.module';
import { ConnectedMailboxModule } from '../connected-mailbox/connected-mailbox.module';
import { DocumentsModule } from '../documents/documents.module';
import { ApplicationsModule } from '../applications/applications.module';
import { INBOX_WATCH_REPOSITORY } from './domain/ports/inbox-watch.repository';
import { INBOX_MESSAGE_REPOSITORY } from './domain/ports/inbox-message.repository';
import { INBOX_MESSAGE_CORRECTION_REPOSITORY } from './domain/ports/inbox-message-correction.repository';
import { APPLICATION_TRANSITION_PROPOSAL_REPOSITORY } from './domain/ports/application-transition-proposal.repository';
import { REPLY_DRAFT_REPOSITORY } from './domain/ports/reply-draft.repository';
import { NOTIFICATION_REPOSITORY, NOTIFICATION_PREFERENCE_REPOSITORY } from './domain/ports/notification.repository';
import { CONNECTED_INBOX_PROVIDERS } from './domain/ports/connected-inbox-provider.port';
import { AI_CLASSIFICATION_PORT } from './domain/ports/ai-classification.port';
import { PrismaInboxWatchRepository } from './infrastructure/persistence/prisma-inbox-watch.repository';
import { PrismaInboxMessageRepository } from './infrastructure/persistence/prisma-inbox-message.repository';
import { PrismaInboxMessageCorrectionRepository } from './infrastructure/persistence/prisma-inbox-message-correction.repository';
import { PrismaApplicationTransitionProposalRepository } from './infrastructure/persistence/prisma-application-transition-proposal.repository';
import { PrismaReplyDraftRepository } from './infrastructure/persistence/prisma-reply-draft.repository';
import { PrismaNotificationRepository, PrismaNotificationPreferenceRepository } from './infrastructure/persistence/prisma-notification.repository';
import { GmailInboxProviderAdapter } from './infrastructure/adapters/gmail-inbox-provider.adapter';
import { MicrosoftOutlookInboxProviderAdapter } from './infrastructure/adapters/microsoft-outlook-inbox-provider.adapter';
import { DisabledAiClassificationAdapter } from './infrastructure/adapters/disabled-ai-classification.adapter';
import { InboxAccessTokenService } from './application/services/inbox-access-token.service';
import { InboxWatchService } from './application/services/inbox-watch.service';
import { InboxConsentService } from './application/services/inbox-consent.service';
import { ApplicationTransitionProposalService } from './application/services/application-transition-proposal.service';
import { NotificationService } from './application/services/notification.service';
import { ReplyIngestionService } from './application/services/reply-ingestion.service';
import { ReplyDraftService } from './application/services/reply-draft.service';
import { InboxCorrectionService } from './application/services/inbox-correction.service';
import { InboxRetentionService } from './application/services/inbox-retention.service';
import { InboxChangePollingService } from './application/services/inbox-change-polling.service';
import { InboxPollingTickDriverService } from './application/services/inbox-polling-tick-driver.service';
import { InboxWatchRenewalTickDriverService } from './application/services/inbox-watch-renewal-tick-driver.service';
import { MailboxOAuthCallbackController } from './presentation/controllers/mailbox-oauth-callback.controller';
import { GmailInboxWebhookController } from './presentation/controllers/gmail-inbox-webhook.controller';
import { MicrosoftGraphInboxWebhookController } from './presentation/controllers/microsoft-graph-inbox-webhook.controller';
import { InboxIntelligenceController } from './presentation/controllers/inbox-intelligence.controller';
import { AdminInboxIntelligenceController } from './presentation/controllers/admin-inbox-intelligence.controller';

/**
 * M29 — Inbox Intelligence: detects, correlates, and classifies replies to applications sent
 * through `connected-mailbox` (M28.6), as a SEPARATE, explicitly-upgraded consent layer (Phase 2's
 * own "do not merge send consent and inbox consent"). Depends on `ConnectedMailboxModule` (the
 * mailbox row itself, OAuth transaction/token-vault machinery, and the send adapters reused for
 * the OAuth exchange step of an inbox-upgrade), `DocumentsModule` (the shared
 * `EmailSecurityAuditService` this module extends with 24 new event types), and `ApplicationsModule`
 * (real transition commands via `CommandBus` — never a direct entity mutation). A one-directional
 * dependency graph: `inbox-intelligence` depends on `connected-mailbox`, never the reverse (see
 * `MailboxOAuthCallbackController`'s own doc comment for why the shared OAuth callback route had
 * to move here).
 *
 * `CONNECTED_INBOX_PROVIDERS` is a DI array token (matching M28.6's `CONNECTED_MAILBOX_PROVIDERS`
 * precedent) bound to both real inbox-reading adapters. `AI_CLASSIFICATION_PORT` is bound to
 * `DisabledAiClassificationAdapter` — this milestone's own confirmed decision to ship zero real AI
 * vendor integration; wiring one later is a one-line change to this binding, no other code change.
 */
@Module({
  imports: [CqrsModule, ExecutionModule, ConnectedMailboxModule, DocumentsModule, ApplicationsModule],
  controllers: [MailboxOAuthCallbackController, GmailInboxWebhookController, MicrosoftGraphInboxWebhookController, InboxIntelligenceController, AdminInboxIntelligenceController],
  providers: [
    { provide: INBOX_WATCH_REPOSITORY, useClass: PrismaInboxWatchRepository },
    { provide: INBOX_MESSAGE_REPOSITORY, useClass: PrismaInboxMessageRepository },
    { provide: INBOX_MESSAGE_CORRECTION_REPOSITORY, useClass: PrismaInboxMessageCorrectionRepository },
    { provide: APPLICATION_TRANSITION_PROPOSAL_REPOSITORY, useClass: PrismaApplicationTransitionProposalRepository },
    { provide: REPLY_DRAFT_REPOSITORY, useClass: PrismaReplyDraftRepository },
    { provide: NOTIFICATION_REPOSITORY, useClass: PrismaNotificationRepository },
    { provide: NOTIFICATION_PREFERENCE_REPOSITORY, useClass: PrismaNotificationPreferenceRepository },
    { provide: AI_CLASSIFICATION_PORT, useClass: DisabledAiClassificationAdapter },
    GmailInboxProviderAdapter,
    MicrosoftOutlookInboxProviderAdapter,
    {
      provide: CONNECTED_INBOX_PROVIDERS,
      useFactory: (gmail: GmailInboxProviderAdapter, outlook: MicrosoftOutlookInboxProviderAdapter) => [gmail, outlook],
      inject: [GmailInboxProviderAdapter, MicrosoftOutlookInboxProviderAdapter],
    },
    InboxAccessTokenService,
    InboxWatchService,
    InboxConsentService,
    ApplicationTransitionProposalService,
    NotificationService,
    ReplyIngestionService,
    ReplyDraftService,
    InboxCorrectionService,
    InboxRetentionService,
    InboxChangePollingService,
    InboxPollingTickDriverService,
    InboxWatchRenewalTickDriverService,
  ],
})
export class InboxIntelligenceModule {}
