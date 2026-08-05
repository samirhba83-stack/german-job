import { BadRequestException, ConflictException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingLedgerStatus, PlanCode as PrismaPlanCode } from '@german-job-engine/database';
import { PlanCode } from '@german-job-engine/shared-types';
import { USER_REPOSITORY, UserRepository } from '../../../users/domain/repositories/user.repository.interface';
import { SUBSCRIPTION_REPOSITORY, SubscriptionRepository } from '../../domain/repositories/subscription.repository.interface';
import { PAYMENT_PROVIDER_PORT, PaymentProviderPort } from '../../domain/ports/payment-provider.port';
import { BILLING_LEDGER_RECORDER, BillingLedgerRecorder } from '../../domain/ports/billing-ledger-recorder.port';
import {
  BILLING_CUSTOMER_REPOSITORY,
  BillingCustomerRepository,
} from '../../infrastructure/persistence/prisma-billing-customer.repository';
import {
  CHECKOUT_SESSION_REPOSITORY,
  CheckoutSessionRepository,
} from '../../infrastructure/persistence/prisma-checkout-session.repository';
import { getPlanDefinition, isPaidPlan } from '../../domain/plan-catalogue';
import { BillingProductionSafetyService } from './billing-production-safety.service';

export interface StartCheckoutResult {
  readonly checkoutUrl: string;
  readonly expiresAt: Date;
}

/**
 * M27 Phase 4 — the secure checkout entry point. Every step from the milestone brief is real:
 * verifies the plan code against the server-side catalogue (never trusts a client-supplied
 * price/currency/provider-price-id), rejects a duplicate active checkout, resolves the Paddle
 * customer server-side, and returns only the minimum safe response. Production payments stay
 * fail-closed via requireProductionSafety() — a paid checkout in `environment: production`
 * without BILLING_PRODUCTION_PAYMENTS_ENABLED=true is refused outright, never silently
 * downgraded to sandbox behavior.
 */
@Injectable()
export class CheckoutService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptionRepository: SubscriptionRepository,
    @Inject(BILLING_CUSTOMER_REPOSITORY) private readonly billingCustomerRepository: BillingCustomerRepository,
    @Inject(CHECKOUT_SESSION_REPOSITORY) private readonly checkoutSessionRepository: CheckoutSessionRepository,
    @Inject(PAYMENT_PROVIDER_PORT) private readonly paymentProvider: PaymentProviderPort,
    @Inject(BILLING_LEDGER_RECORDER) private readonly ledger: BillingLedgerRecorder,
    private readonly config: ConfigService,
    private readonly productionSafety: BillingProductionSafetyService,
  ) {}

  async startCheckout(userId: string, planCode: PlanCode, idempotencyKey: string, now: Date = new Date()): Promise<StartCheckoutResult> {
    this.productionSafety.assertRealChargesAllowed();

    if (!isPaidPlan(planCode)) {
      throw new BadRequestException('FREE is not purchasable — it requires no checkout.');
    }
    const priceId = this.config.get<Record<string, string>>('billing.priceIds', {})[planCode];
    if (!priceId) {
      throw new ServiceUnavailableException(`No Paddle price is configured for plan "${planCode}" yet.`);
    }

    const existingByKey = await this.checkoutSessionRepository.findByIdempotencyKey(idempotencyKey);
    if (existingByKey) {
      if (existingByKey.userId !== userId) {
        throw new BadRequestException('Idempotency key was already used by a different request.');
      }
      if (existingByKey.status === 'PENDING' && existingByKey.expiresAt > now && existingByKey.paddleCheckoutUrl) {
        return { checkoutUrl: existingByKey.paddleCheckoutUrl, expiresAt: existingByKey.expiresAt };
      }
      if (existingByKey.status === 'COMPLETED') {
        throw new ConflictException('This checkout has already been completed.');
      }
      // PENDING-but-expired or CANCELED/EXPIRED: fall through and create a fresh session below.
    }

    const currentSubscription = await this.subscriptionRepository.findCurrentByUserId(userId);
    if (currentSubscription && currentSubscription.planCode === planCode && currentSubscription.isActive) {
      throw new ConflictException(`Already subscribed to ${getPlanDefinition(planCode).displayName}.`);
    }

    const openCheckout = await this.checkoutSessionRepository.findOpenByUserId(userId, now);
    if (openCheckout) {
      return { checkoutUrl: openCheckout.paddleCheckoutUrl ?? '', expiresAt: openCheckout.expiresAt };
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found.');
    }

    let existingCustomer = await this.billingCustomerRepository.findByUserId(userId);
    const resolved = await this.paymentProvider.resolveOrCreateCustomer({
      email: user.email.value,
      existingProviderCustomerId: existingCustomer?.paddleCustomerId ?? null,
    });
    if (!existingCustomer) {
      existingCustomer = await this.billingCustomerRepository.create(userId, resolved.providerCustomerId);
    }

    const expiryMinutes = this.config.get<number>('billing.checkoutExpiryMinutes', 30);
    const expiresAt = new Date(now.getTime() + expiryMinutes * 60_000);

    const session = await this.paymentProvider.createCheckoutSession({
      providerCustomerId: resolved.providerCustomerId,
      providerPriceId: priceId,
      idempotencyKey,
      successUrl: this.config.get<string>('billing.checkoutSuccessUrl', ''),
      cancelUrl: this.config.get<string>('billing.checkoutCancelUrl', ''),
      metadata: { userId, planCode },
    });

    const prismaPlanCode = planCode as unknown as PrismaPlanCode;
    const record = await this.checkoutSessionRepository.create({
      userId,
      planCode: prismaPlanCode,
      idempotencyKey,
      expiresAt,
      paddleCheckoutUrl: session.providerCheckoutUrl,
      paddleTransactionId: session.providerTransactionId,
    });

    await this.ledger.record({
      eventType: 'CHECKOUT_CREATED',
      userId,
      customerId: resolved.providerCustomerId,
      subscriptionId: null,
      checkoutId: record.id,
      paymentId: null,
      planCode: prismaPlanCode,
      amountCents: getPlanDefinition(planCode).priceCents,
      currency: 'EUR',
      status: BillingLedgerStatus.SUCCESS,
      reason: null,
      actorType: 'USER',
      actorId: userId,
      correlationId: idempotencyKey,
    });

    return { checkoutUrl: session.providerCheckoutUrl, expiresAt };
  }
}
