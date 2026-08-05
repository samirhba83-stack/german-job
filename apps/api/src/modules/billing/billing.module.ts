import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { EmailProviderModule } from '../email-provider/email-provider.module';
import { BillingController } from './presentation/controllers/billing.controller';
import { BillingWebhookController } from './presentation/controllers/billing-webhook.controller';
import { AdminBillingController } from './presentation/controllers/admin-billing.controller';
import { SUBSCRIPTION_REPOSITORY } from './domain/repositories/subscription.repository.interface';
import { PrismaSubscriptionRepository } from './infrastructure/persistence/prisma-subscription.repository';
import { BILLING_CUSTOMER_REPOSITORY } from './infrastructure/persistence/prisma-billing-customer.repository';
import { PrismaBillingCustomerRepository } from './infrastructure/persistence/prisma-billing-customer.repository';
import { CHECKOUT_SESSION_REPOSITORY } from './infrastructure/persistence/prisma-checkout-session.repository';
import { PrismaCheckoutSessionRepository } from './infrastructure/persistence/prisma-checkout-session.repository';
import { WEBHOOK_EVENT_REPOSITORY } from './infrastructure/persistence/prisma-webhook-event.repository';
import { PrismaWebhookEventRepository } from './infrastructure/persistence/prisma-webhook-event.repository';
import { REFUND_REPOSITORY } from './infrastructure/persistence/prisma-refund.repository';
import { PrismaRefundRepository } from './infrastructure/persistence/prisma-refund.repository';
import { PrismaBillingLedgerRepository } from './infrastructure/persistence/prisma-billing-ledger.repository';
import { BILLING_LEDGER_RECORDER } from './domain/ports/billing-ledger-recorder.port';
import { PAYMENT_PROVIDER_PORT } from './domain/ports/payment-provider.port';
import { PaddlePaymentAdapter } from './infrastructure/payment-providers/paddle/paddle-payment.adapter';
import { BillingEntitlementProjectionService } from './application/services/billing-entitlement-projection.service';
import { CheckoutService } from './application/services/checkout.service';
import { WebhookProcessingService } from './application/services/webhook-processing.service';
import { CancellationService } from './application/services/cancellation.service';
import { PlanChangeService } from './application/services/plan-change.service';
import { RefundService } from './application/services/refund.service';
import { BillingNotificationService } from './application/services/billing-notification.service';
import { BillingProductionSafetyService } from './application/services/billing-production-safety.service';

/**
 * M27 — Billing & Subscriptions, mounted into AppModule for the first time (it existed only as
 * an unmounted stub through M26 — see app.module.ts's own doc comment history). Every provider
 * here is real: PAYMENT_PROVIDER_PORT binds to the real (sandbox-by-default) PaddlePaymentAdapter
 * in the running application. BillingEntitlementProjectionService is exported as the one
 * centralized entitlement authority other modules (execution-activation) depend on.
 *
 * Test coverage today (honest accounting, not aspirational): unit tests for the `Subscription`
 * state machine, the Paddle webhook signature verification, and `WebhookProcessingService`'s
 * dispatch/dedup logic (all mock the ports/repositories directly — no `FakePaymentProviderAdapter`
 * DI override exists), plus a real Postgres concurrency test for the two DB-level uniqueness
 * constraints (`webhook-and-checkout-dedup.concurrency.spec.ts`, run via `pnpm test:concurrency`).
 * No controller-level e2e suite exists yet for this module — a real, named gap, not silently
 * assumed covered.
 */
@Module({
  imports: [UsersModule, EmailProviderModule],
  controllers: [BillingController, BillingWebhookController, AdminBillingController],
  providers: [
    { provide: SUBSCRIPTION_REPOSITORY, useClass: PrismaSubscriptionRepository },
    { provide: BILLING_CUSTOMER_REPOSITORY, useClass: PrismaBillingCustomerRepository },
    { provide: CHECKOUT_SESSION_REPOSITORY, useClass: PrismaCheckoutSessionRepository },
    { provide: WEBHOOK_EVENT_REPOSITORY, useClass: PrismaWebhookEventRepository },
    { provide: REFUND_REPOSITORY, useClass: PrismaRefundRepository },
    PrismaBillingLedgerRepository,
    { provide: BILLING_LEDGER_RECORDER, useExisting: PrismaBillingLedgerRepository },
    { provide: PAYMENT_PROVIDER_PORT, useClass: PaddlePaymentAdapter },
    BillingEntitlementProjectionService,
    BillingNotificationService,
    BillingProductionSafetyService,
    CheckoutService,
    WebhookProcessingService,
    CancellationService,
    PlanChangeService,
    RefundService,
  ],
  exports: [SUBSCRIPTION_REPOSITORY, BillingEntitlementProjectionService, BILLING_LEDGER_RECORDER, PAYMENT_PROVIDER_PORT],
})
export class BillingModule {}
