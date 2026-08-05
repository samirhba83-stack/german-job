import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BillingLedgerStatus, PlanCode as PrismaPlanCode } from '@german-job-engine/database';
import { PAYMENT_PROVIDER_PORT, PaymentProviderPort } from '../../domain/ports/payment-provider.port';
import { BILLING_LEDGER_RECORDER, BillingLedgerRecorder } from '../../domain/ports/billing-ledger-recorder.port';
import { SUBSCRIPTION_REPOSITORY, SubscriptionRepository } from '../../domain/repositories/subscription.repository.interface';

/**
 * M27 Phase 11 — cancellation is always end-of-period (the approved policy: "Cancellation:
 * Effective at period end"), never immediate. The real Paddle subscription is only told to
 * cancel "at next billing period" too — access and the underlying Paddle subscription stay in
 * sync; resumeBeforePeriodEnd() undoes both sides cleanly since nothing was actually canceled
 * yet on Paddle's side either.
 */
@Injectable()
export class CancellationService {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptionRepository: SubscriptionRepository,
    @Inject(PAYMENT_PROVIDER_PORT) private readonly paymentProvider: PaymentProviderPort,
    @Inject(BILLING_LEDGER_RECORDER) private readonly ledger: BillingLedgerRecorder,
  ) {}

  async scheduleCancellation(userId: string, reason: string | null, now: Date = new Date()): Promise<void> {
    const subscription = await this.subscriptionRepository.findCurrentByUserId(userId);
    if (!subscription) {
      throw new NotFoundException('No active subscription to cancel — you are already on the Free plan.');
    }

    await this.paymentProvider.cancelSubscription(subscription.paddleSubscriptionId, true);
    subscription.scheduleCancellationAtPeriodEnd(reason, now);
    await this.subscriptionRepository.save(subscription);

    await this.ledger.record({
      eventType: 'SUBSCRIPTION_CANCEL_SCHEDULED',
      userId,
      customerId: subscription.paddleCustomerId,
      subscriptionId: subscription.id,
      checkoutId: null,
      paymentId: null,
      planCode: subscription.planCode as unknown as PrismaPlanCode,
      amountCents: null,
      currency: null,
      status: BillingLedgerStatus.SUCCESS,
      reason,
      actorType: 'USER',
      actorId: userId,
      correlationId: subscription.id,
    });
  }

  async resumeBeforePeriodEnd(userId: string, now: Date = new Date()): Promise<void> {
    const subscription = await this.subscriptionRepository.findCurrentByUserId(userId);
    if (!subscription || !subscription.cancelAtPeriodEnd) {
      throw new BadRequestException('No scheduled cancellation to undo.');
    }

    await this.paymentProvider.resumeScheduledCancellation(subscription.paddleSubscriptionId);
    subscription.resumeFromScheduledCancellation(now);
    await this.subscriptionRepository.save(subscription);

    await this.ledger.record({
      eventType: 'SUBSCRIPTION_CHANGED',
      userId,
      customerId: subscription.paddleCustomerId,
      subscriptionId: subscription.id,
      checkoutId: null,
      paymentId: null,
      planCode: subscription.planCode as unknown as PrismaPlanCode,
      amountCents: null,
      currency: null,
      status: BillingLedgerStatus.SUCCESS,
      reason: 'RESUMED_BEFORE_PERIOD_END',
      actorType: 'USER',
      actorId: userId,
      correlationId: subscription.id,
    });
  }
}
