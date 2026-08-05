import { Module } from '@nestjs/common';
import { ExecutionModule } from '../execution/execution.module';
import { ProviderSelectionModule } from '../provider-selection/provider-selection.module';
import { DocumentsModule } from '../documents/documents.module';
import { EMAIL_PROVIDER_MANAGER_PORT } from './domain/ports/email-provider-manager.port';
import { EMAIL_PROVIDER_HEALTH_REPOSITORY } from './domain/ports/email-provider-health.repository';
import { EMAIL_QUEUE_REPOSITORY } from './domain/ports/email-queue.repository';
import { EMAIL_EVENT_REPOSITORY } from './domain/ports/email-event.repository';
import { EMAIL_SUPPRESSION_REPOSITORY } from './domain/ports/email-suppression.repository';
import { EMAIL_PROVIDER_WEBHOOK_EVENT_REPOSITORY } from './domain/ports/email-provider-webhook-event.repository';
import { SENDER_IDENTITY_REPOSITORY } from './domain/ports/sender-identity.repository';
import { PrismaEmailProviderHealthRepository } from './infrastructure/persistence/prisma-email-provider-health.repository';
import { PrismaEmailQueueRepository } from './infrastructure/persistence/prisma-email-queue.repository';
import { PrismaEmailEventRepository } from './infrastructure/persistence/prisma-email-event.repository';
import { PrismaEmailSuppressionRepository } from './infrastructure/persistence/prisma-email-suppression.repository';
import { PrismaEmailProviderWebhookEventRepository } from './infrastructure/persistence/prisma-email-provider-webhook-event.repository';
import { PrismaSenderIdentityRepository } from './infrastructure/persistence/prisma-sender-identity.repository';
import { SesDomainVerificationChecker } from './infrastructure/adapters/ses-domain-verification-checker';
import { ResendWebhookVerifier } from './infrastructure/webhooks/resend-webhook-verifier';
import { SendGridWebhookVerifier } from './infrastructure/webhooks/sendgrid-webhook-verifier';
import { SesSnsVerifier } from './infrastructure/webhooks/ses-sns-verifier';
import { EmailProviderManagerService } from './application/services/email-provider-manager.service';
import { EmailTrackingService } from './application/services/email-tracking.service';
import { DeliverabilityService } from './application/services/deliverability.service';
import { EmailQueueService } from './application/services/email-queue.service';
import { EmailQueueWorkerService } from './application/services/email-queue-worker.service';
import { EmailWebhookProcessingService } from './application/services/email-webhook-processing.service';
import { DomainReadinessService } from './application/services/domain-readiness.service';
import { PlatformSenderResolutionService } from './application/services/platform-sender-resolution.service';
import { EmailWebhooksController } from './presentation/controllers/email-webhooks.controller';
import { AdminEmailController } from './presentation/controllers/admin-email.controller';

/**
 * M28 — Email Infrastructure: Provider Manager (real automatic failover on top of the existing
 * Provider Selection Engine), the Postgres-backed production Queue, Deliverability (bounce/
 * complaint handling, suppression, reputation), Tracking (immutable event history), per-provider
 * webhook intake, and Admin Operations — all in one module, matching this codebase's own
 * precedent (`BillingModule`, M27) for a single cohesive bounded context that legitimately spans
 * several related concerns rather than fragmenting into many tiny modules.
 *
 * Imports `ProviderSelectionModule` (for the existing selection engine + the real `EMAIL_PROVIDERS`
 * registry, now populated with the 4 real adapters — see that module's own updated doc comment)
 * — a one-directional dependency (`deliverability` -> `provider-selection` -> `email-provider`),
 * never the reverse, so no cycle is possible.
 */
@Module({
  imports: [ExecutionModule, ProviderSelectionModule, DocumentsModule],
  controllers: [EmailWebhooksController, AdminEmailController],
  providers: [
    { provide: EMAIL_PROVIDER_HEALTH_REPOSITORY, useClass: PrismaEmailProviderHealthRepository },
    { provide: EMAIL_QUEUE_REPOSITORY, useClass: PrismaEmailQueueRepository },
    { provide: EMAIL_EVENT_REPOSITORY, useClass: PrismaEmailEventRepository },
    { provide: EMAIL_SUPPRESSION_REPOSITORY, useClass: PrismaEmailSuppressionRepository },
    { provide: EMAIL_PROVIDER_WEBHOOK_EVENT_REPOSITORY, useClass: PrismaEmailProviderWebhookEventRepository },
    { provide: SENDER_IDENTITY_REPOSITORY, useClass: PrismaSenderIdentityRepository },
    SesDomainVerificationChecker,
    ResendWebhookVerifier,
    SendGridWebhookVerifier,
    SesSnsVerifier,
    DomainReadinessService,
    PlatformSenderResolutionService,
    EmailProviderManagerService,
    { provide: EMAIL_PROVIDER_MANAGER_PORT, useExisting: EmailProviderManagerService },
    EmailTrackingService,
    DeliverabilityService,
    EmailQueueService,
    EmailQueueWorkerService,
    EmailWebhookProcessingService,
  ],
  exports: [EMAIL_PROVIDER_MANAGER_PORT, EmailQueueService, EmailTrackingService, DeliverabilityService, DomainReadinessService, SENDER_IDENTITY_REPOSITORY, PlatformSenderResolutionService],
})
export class DeliverabilityModule {}
