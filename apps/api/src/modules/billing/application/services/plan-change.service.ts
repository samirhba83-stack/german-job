import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingLedgerStatus, PlanCode as PrismaPlanCode } from '@german-job-engine/database';
import { PlanCode } from '@german-job-engine/shared-types';
import { SUBSCRIPTION_REPOSITORY, SubscriptionRepository } from '../../domain/repositories/subscription.repository.interface';
import { PAYMENT_PROVIDER_PORT, PaymentProviderPort } from '../../domain/ports/payment-provider.port';
import { BILLING_LEDGER_RECORDER, BillingLedgerRecorder } from '../../domain/ports/billing-ledger-recorder.port';
import { isPaidPlan } from '../../domain/plan-catalogue';
import { BillingProductionSafetyService } from './billing-production-safety.service';

/**
 * M27 — upgrade/downgrade between paid plans. Paddle computes proration server-side
 * (prorated_immediately — see PaddlePaymentAdapter.changeSubscriptionPlan); this service only
 * ever sends a server-side-trusted price id resolved from the plan catalogue, never a
 * client-supplied one, and records the resulting internal state after Paddle confirms it.
 */
@Injectable()
export class PlanChangeService {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptionRepository: SubscriptionRepository,
    @Inject(PAYMENT_PROVIDER_PORT) private readonly paymentProvider: PaymentProviderPort,
    @Inject(BILLING_LEDGER_RECORDER) private readonly ledger: BillingLedgerRecorder,
    private readonly config: ConfigService,
    private readonly productionSafety: BillingProductionSafetyService,
  ) {}

  async changePlan(userId: string, newPlanCode: PlanCode, now: Date = new Date()): Promise<void> {
    // Real production safety gate — Paddle bills the proration immediately
    // (`proration_billing_mode: 'prorated_immediately'` below), so this is exactly the kind of
    // real, immediate charge the gate exists to block absent explicit operator activation. Found
    // missing during the M27 security review: only `CheckoutService.startCheckout` had this check
    // before, even though a plan change is just as capable of moving real money.
    this.productionSafety.assertRealChargesAllowed();

    if (!isPaidPlan(newPlanCode)) {
      throw new BadRequestException('Cannot change to FREE directly — cancel your subscription instead.');
    }

    const subscription = await this.subscriptionRepository.findCurrentByUserId(userId);
    if (!subscription) {
      throw new NotFoundException('No active subscription — start a checkout instead of changing plan.');
    }
    if (subscription.planCode === newPlanCode) {
      throw new ConflictException(`Already on ${newPlanCode}.`);
    }
    if (!subscription.isActive) {
      throw new ConflictException(`Cannot change plan while subscription status is ${subscription.status}.`);
    }

    const priceId = this.config.get<Record<string, string>>('billing.priceIds', {})[newPlanCode];
    if (!priceId) {
      throw new ServiceUnavailableException(`No Paddle price is configured for plan "${newPlanCode}" yet.`);
    }

    const providerState = await this.paymentProvider.changeSubscriptionPlan(subscription.paddleSubscriptionId, priceId);
    subscription.changePlan(newPlanCode, providerState.currentPeriodEnd, now);
    await this.subscriptionRepository.save(subscription);

    await this.ledger.record({
      eventType: 'SUBSCRIPTION_CHANGED',
      userId,
      customerId: subscription.paddleCustomerId,
      subscriptionId: subscription.id,
      checkoutId: null,
      paymentId: null,
      planCode: newPlanCode as unknown as PrismaPlanCode,
      amountCents: null,
      currency: null,
      status: BillingLedgerStatus.SUCCESS,
      reason: null,
      actorType: 'USER',
      actorId: userId,
      correlationId: subscription.id,
    });
  }
}
