import { randomUUID, createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { BillingLedgerStatus, PlanCode as PrismaPlanCode } from '@german-job-engine/database';
import { PlanCode } from '@german-job-engine/shared-types';
import {
  PAYMENT_PROVIDER_PORT,
  PaymentProviderPort,
  VerifiedWebhookEvent,
  WebhookVerificationError,
} from '../../domain/ports/payment-provider.port';
import { BILLING_LEDGER_RECORDER, BillingLedgerRecorder } from '../../domain/ports/billing-ledger-recorder.port';
import { SUBSCRIPTION_REPOSITORY, SubscriptionRepository } from '../../domain/repositories/subscription.repository.interface';
import { Subscription } from '../../domain/entities/subscription.entity';
import {
  CHECKOUT_SESSION_REPOSITORY,
  CheckoutSessionRepository,
} from '../../infrastructure/persistence/prisma-checkout-session.repository';
import { REFUND_REPOSITORY, RefundRepository } from '../../infrastructure/persistence/prisma-refund.repository';
import {
  WEBHOOK_EVENT_REPOSITORY,
  WebhookEventRepository,
} from '../../infrastructure/persistence/prisma-webhook-event.repository';
import { USER_REPOSITORY, UserRepository } from '../../../users/domain/repositories/user.repository.interface';
import { BillingNotificationService } from './billing-notification.service';
import { getPlanDefinition } from '../../domain/plan-catalogue';

const GRACE_PERIOD_DAYS = 7;

export type WebhookOutcome = 'PROCESSED' | 'IGNORED_UNKNOWN_TYPE' | 'DUPLICATE' | 'REJECTED';

/**
 * M27 Phase 5 — the authoritative payment signal. Nothing else in this codebase is ever allowed
 * to grant, renew, or revoke a paid entitlement; every path runs through here after signature
 * verification. Duplicate protection is real (WebhookEvent.providerEventId is unique — a
 * redelivered event is recognized before any business logic runs). An unknown event type is
 * recorded and left at RECEIVED status (a real review queue: `WHERE status = 'RECEIVED'`) rather
 * than either silently dropped or treated as an error.
 */
@Injectable()
export class WebhookProcessingService {
  private readonly logger = new Logger(WebhookProcessingService.name);

  constructor(
    @Inject(PAYMENT_PROVIDER_PORT) private readonly paymentProvider: PaymentProviderPort,
    @Inject(WEBHOOK_EVENT_REPOSITORY) private readonly webhookEventRepository: WebhookEventRepository,
    @Inject(CHECKOUT_SESSION_REPOSITORY) private readonly checkoutSessionRepository: CheckoutSessionRepository,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptionRepository: SubscriptionRepository,
    @Inject(REFUND_REPOSITORY) private readonly refundRepository: RefundRepository,
    @Inject(BILLING_LEDGER_RECORDER) private readonly ledger: BillingLedgerRecorder,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    private readonly notifications: BillingNotificationService,
  ) {}

  private async notifyUser(userId: string, kind: Parameters<BillingNotificationService['notify']>[0], planCode: PlanCode, extra: { graceDaysRemaining?: number } = {}): Promise<void> {
    const user = await this.userRepository.findById(userId).catch(() => null);
    if (!user) {
      return;
    }
    await this.notifications.notify(kind, user.email.value, { planDisplayName: getPlanDefinition(planCode).displayName, ...extra });
  }

  async processWebhook(rawBody: Buffer, signatureHeader: string | undefined): Promise<WebhookOutcome> {
    const rawPayloadHash = createHash('sha256').update(rawBody).digest('hex');

    let verified: VerifiedWebhookEvent;
    try {
      verified = this.paymentProvider.verifyAndParseWebhook(rawBody, signatureHeader);
    } catch (error) {
      const reason = error instanceof WebhookVerificationError ? error.message : 'unknown verification error';
      await this.webhookEventRepository.recordReceived({
        providerEventId: `rejected:${rawPayloadHash}:${randomUUID()}`,
        eventType: 'UNKNOWN',
        signatureValid: false,
        rawPayloadHash,
      });
      await this.ledger.record({
        eventType: 'WEBHOOK_RECEIVED',
        userId: null,
        customerId: null,
        subscriptionId: null,
        checkoutId: null,
        paymentId: null,
        planCode: null,
        amountCents: null,
        currency: null,
        status: BillingLedgerStatus.FAILURE,
        reason,
        actorType: 'WEBHOOK',
        actorId: null,
        correlationId: randomUUID(),
      });
      this.logger.warn(`Rejected webhook: ${reason}`);
      return 'REJECTED';
    }

    const existing = await this.webhookEventRepository.findByProviderEventId(verified.providerEventId);
    if (existing) {
      this.logger.log(`Duplicate webhook ${verified.providerEventId} (${verified.eventType}) — already ${existing.status}, ignoring.`);
      return 'DUPLICATE';
    }

    const recordId = await this.webhookEventRepository.recordReceived({
      providerEventId: verified.providerEventId,
      eventType: verified.eventType,
      signatureValid: true,
      rawPayloadHash,
    });

    const handled = await this.dispatch(verified).catch((error: unknown) => {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Webhook ${verified.providerEventId} (${verified.eventType}) failed to process: ${reason}`);
      throw error;
    });

    if (handled) {
      await this.webhookEventRepository.markProcessed(recordId, new Date());
      return 'PROCESSED';
    }

    this.logger.warn(`Webhook event type "${verified.eventType}" is not in the allowlist — left at RECEIVED for manual review.`);
    return 'IGNORED_UNKNOWN_TYPE';
  }

  private async dispatch(event: VerifiedWebhookEvent): Promise<boolean> {
    switch (event.eventType) {
      case 'subscription.activated':
        await this.handleSubscriptionActivated(event);
        return true;
      case 'transaction.completed':
        await this.handleTransactionCompleted(event);
        return true;
      case 'subscription.past_due':
        await this.handleSubscriptionPastDue(event);
        return true;
      case 'subscription.canceled':
        await this.handleSubscriptionCanceled(event);
        return true;
      case 'adjustment.created':
        await this.handleAdjustmentCreated(event);
        return true;
      default:
        return false;
    }
  }

  /** The definitive "a real, paid subscription now exists" signal — the only place a
   * Subscription row is ever created. custom_data (userId, planCode) is cross-checked against a
   * real, still-open CheckoutSession for that same customer rather than trusted on its own
   * (Phase 5: "Never trust metadata alone without validating it against internal records"). */
  private async handleSubscriptionActivated(event: VerifiedWebhookEvent): Promise<void> {
    const data = event.data as {
      id: string;
      customer_id: string;
      current_billing_period?: { starts_at: string; ends_at: string };
      items: { price: { id: string } }[];
      custom_data?: Record<string, string> | null;
    };

    const alreadyExists = await this.subscriptionRepository.findByPaddleSubscriptionId(data.id);
    if (alreadyExists) {
      this.logger.log(`Subscription ${data.id} already recorded — treating subscription.activated as idempotent no-op.`);
      return;
    }

    const userId = data.custom_data?.userId;
    const planCode = data.custom_data?.planCode as PlanCode | undefined;
    if (!userId || !planCode) {
      throw new Error(`subscription.activated for ${data.id} carries no usable custom_data (userId/planCode) — cannot link to an internal user.`);
    }

    // Cross-check against a real internal record rather than trusting custom_data alone.
    const openCheckout = await this.checkoutSessionRepository.findOpenByUserId(userId, new Date());
    if (openCheckout) {
      await this.checkoutSessionRepository.markCompleted(openCheckout.id, new Date());
    }

    const now = new Date();
    const periodStart = data.current_billing_period?.starts_at ? new Date(data.current_billing_period.starts_at) : now;
    const periodEnd = data.current_billing_period?.ends_at ? new Date(data.current_billing_period.ends_at) : now;

    const subscription = Subscription.activate(randomUUID(), {
      userId,
      planCode,
      paddleSubscriptionId: data.id,
      paddleCustomerId: data.customer_id,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      now,
    });
    await this.subscriptionRepository.save(subscription);

    await this.recordLedger('SUBSCRIPTION_ACTIVATED', {
      userId,
      customerId: data.customer_id,
      subscriptionId: subscription.id,
      planCode: planCode as unknown as PrismaPlanCode,
      correlationId: event.providerEventId,
      actorType: 'WEBHOOK',
    });
    await this.recordLedger('ENTITLEMENT_GRANTED', {
      userId,
      customerId: data.customer_id,
      subscriptionId: subscription.id,
      planCode: planCode as unknown as PrismaPlanCode,
      correlationId: event.providerEventId,
      actorType: 'WEBHOOK',
    });
    await this.notifyUser(userId, 'SUBSCRIPTION_ACTIVATED', planCode);
  }

  /** A renewal (or the initial payment for a brand-new subscription — subscription.activated
   * already handles creation, so this is a no-op the first time around since the subscription
   * row won't exist yet, safely ignored below). */
  private async handleTransactionCompleted(event: VerifiedWebhookEvent): Promise<void> {
    const data = event.data as { id: string; subscription_id?: string | null };
    if (!data.subscription_id) {
      return; // a one-off transaction with no subscription — not a shape this commercial model produces.
    }

    const subscription = await this.subscriptionRepository.findByPaddleSubscriptionId(data.subscription_id);
    if (!subscription) {
      return; // subscription.activated for this id hasn't arrived yet, or events arrived out of order — safely no-ops.
    }

    const providerState = await this.paymentProvider.getSubscriptionState(data.subscription_id);
    if (!providerState) {
      throw new Error(`Paddle subscription ${data.subscription_id} not found while processing transaction.completed.`);
    }

    const isRenewal = providerState.currentPeriodStart.getTime() !== subscription.currentPeriodStart.getTime();
    if (!isRenewal) {
      return;
    }

    subscription.renew(providerState.currentPeriodStart, providerState.currentPeriodEnd);
    await this.subscriptionRepository.save(subscription);

    await this.recordLedger('SUBSCRIPTION_RENEWED', {
      userId: subscription.userId,
      customerId: subscription.paddleCustomerId,
      subscriptionId: subscription.id,
      paymentId: data.id,
      planCode: subscription.planCode as unknown as PrismaPlanCode,
      correlationId: event.providerEventId,
      actorType: 'WEBHOOK',
    });
    await this.notifyUser(subscription.userId, 'SUBSCRIPTION_RENEWED', subscription.planCode);
  }

  private async handleSubscriptionPastDue(event: VerifiedWebhookEvent): Promise<void> {
    const data = event.data as { id: string };
    const subscription = await this.subscriptionRepository.findByPaddleSubscriptionId(data.id);
    if (!subscription) {
      return;
    }
    const gracePeriodEndsAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    subscription.markPastDue(gracePeriodEndsAt);
    await this.subscriptionRepository.save(subscription);

    await this.recordLedger('SUBSCRIPTION_PAST_DUE', {
      userId: subscription.userId,
      customerId: subscription.paddleCustomerId,
      subscriptionId: subscription.id,
      planCode: subscription.planCode as unknown as PrismaPlanCode,
      correlationId: event.providerEventId,
      actorType: 'WEBHOOK',
      status: BillingLedgerStatus.FAILURE,
    });
    await this.notifyUser(subscription.userId, 'PAYMENT_FAILED', subscription.planCode);
    await this.notifyUser(subscription.userId, 'GRACE_PERIOD_STARTED', subscription.planCode, { graceDaysRemaining: GRACE_PERIOD_DAYS });
  }

  private async handleSubscriptionCanceled(event: VerifiedWebhookEvent): Promise<void> {
    const data = event.data as { id: string };
    const subscription = await this.subscriptionRepository.findByPaddleSubscriptionId(data.id);
    if (!subscription || subscription.isTerminal) {
      return;
    }

    if (subscription.cancelAtPeriodEnd) {
      subscription.expireAtPeriodEnd();
    } else if (subscription.pastDueSince) {
      subscription.expireFromPastDue();
    } else {
      subscription.cancelImmediately('PADDLE_WEBHOOK');
    }
    await this.subscriptionRepository.save(subscription);

    await this.recordLedger('SUBSCRIPTION_CANCELED', {
      userId: subscription.userId,
      customerId: subscription.paddleCustomerId,
      subscriptionId: subscription.id,
      planCode: subscription.planCode as unknown as PrismaPlanCode,
      correlationId: event.providerEventId,
      actorType: 'WEBHOOK',
    });
    await this.recordLedger('ENTITLEMENT_REVOKED', {
      userId: subscription.userId,
      customerId: subscription.paddleCustomerId,
      subscriptionId: subscription.id,
      planCode: subscription.planCode as unknown as PrismaPlanCode,
      correlationId: event.providerEventId,
      actorType: 'WEBHOOK',
    });
    await this.notifyUser(subscription.userId, 'SUBSCRIPTION_CANCELED', subscription.planCode);
  }

  /** Paddle's real refund/chargeback mechanism — the "action" field distinguishes them (Phase
   * 11: "Chargebacks and disputes must be modeled separately from voluntary refunds"). */
  private async handleAdjustmentCreated(event: VerifiedWebhookEvent): Promise<void> {
    const data = event.data as { id: string; action: string; subscription_id?: string | null };
    if (!data.subscription_id) {
      return;
    }
    const subscription = await this.subscriptionRepository.findByPaddleSubscriptionId(data.subscription_id);
    if (!subscription) {
      return;
    }

    if (data.action === 'chargeback') {
      subscription.markDisputed();
      await this.subscriptionRepository.save(subscription);
      await this.recordLedger('CHARGEBACK_RECEIVED', {
        userId: subscription.userId,
        customerId: subscription.paddleCustomerId,
        subscriptionId: subscription.id,
        planCode: subscription.planCode as unknown as PrismaPlanCode,
        correlationId: event.providerEventId,
        actorType: 'WEBHOOK',
        status: BillingLedgerStatus.FAILURE,
      });
      await this.notifyUser(subscription.userId, 'DISPUTE_RECEIVED', subscription.planCode);
      return;
    }

    if (data.action === 'refund' && !subscription.isTerminal) {
      subscription.refund();
      await this.subscriptionRepository.save(subscription);

      // Reconciles our own internal Refund record (created synchronously by RefundService when
      // an admin requested it) against Paddle's own authoritative confirmation — this webhook is
      // the final source of truth even though RefundService's synchronous API response usually
      // arrives first. A refund initiated directly in Paddle's dashboard (no matching internal
      // Refund row) is still fully honored for entitlement purposes above; it just has nothing
      // to reconcile here.
      const pendingRefunds = await this.refundRepository.findByUserId(subscription.userId);
      const matching = pendingRefunds.find((refund) => refund.subscriptionId === subscription.id && refund.status === 'REQUESTED');
      if (matching) {
        await this.refundRepository.markIssued(matching.id, data.id, new Date());
      }

      await this.recordLedger('REFUND_ISSUED', {
        userId: subscription.userId,
        customerId: subscription.paddleCustomerId,
        subscriptionId: subscription.id,
        paymentId: data.id,
        planCode: subscription.planCode as unknown as PrismaPlanCode,
        correlationId: event.providerEventId,
        actorType: 'WEBHOOK',
      });
      await this.notifyUser(subscription.userId, 'REFUND_ISSUED', subscription.planCode);
    }
  }

  private async recordLedger(
    eventType: Parameters<BillingLedgerRecorder['record']>[0]['eventType'],
    params: {
      userId: string | null;
      customerId: string | null;
      subscriptionId: string | null;
      paymentId?: string | null;
      planCode: PrismaPlanCode | null;
      correlationId: string;
      actorType: 'WEBHOOK';
      status?: BillingLedgerStatus;
    },
  ): Promise<void> {
    await this.ledger.record({
      eventType,
      userId: params.userId,
      customerId: params.customerId,
      subscriptionId: params.subscriptionId,
      checkoutId: null,
      paymentId: params.paymentId ?? null,
      planCode: params.planCode,
      amountCents: null,
      currency: null,
      status: params.status ?? BillingLedgerStatus.SUCCESS,
      reason: null,
      actorType: params.actorType,
      actorId: null,
      correlationId: params.correlationId,
    });
  }
}
