import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingLedgerStatus, PlanCode as PrismaPlanCode } from '@german-job-engine/database';
import { SUBSCRIPTION_REPOSITORY, SubscriptionRepository } from '../../domain/repositories/subscription.repository.interface';
import { PAYMENT_PROVIDER_PORT, PaymentProviderPort } from '../../domain/ports/payment-provider.port';
import { BILLING_LEDGER_RECORDER, BillingLedgerRecorder } from '../../domain/ports/billing-ledger-recorder.port';
import { REFUND_REPOSITORY, RefundRepository, RefundRecord } from '../../infrastructure/persistence/prisma-refund.repository';
import { getPlanDefinition } from '../../domain/plan-catalogue';

/**
 * M27 Phase 11/12 — admin-only, policy-bound refunds. The approved policy: "Refund: Available
 * within 7 days of the first successful payment. Refund approval: Admin only." Every refund
 * requires a reason and produces an immutable audit trail (the ledger entry plus the Refund row
 * itself, never updated except its own status field). Never callable from unauthenticated or
 * non-admin input — enforced at the controller layer (RolesGuard), not just here, but this
 * service re-validates eligibility itself rather than trusting the controller alone.
 */
@Injectable()
export class RefundService {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptionRepository: SubscriptionRepository,
    @Inject(PAYMENT_PROVIDER_PORT) private readonly paymentProvider: PaymentProviderPort,
    @Inject(REFUND_REPOSITORY) private readonly refundRepository: RefundRepository,
    @Inject(BILLING_LEDGER_RECORDER) private readonly ledger: BillingLedgerRecorder,
    private readonly config: ConfigService,
  ) {}

  async issueRefund(params: { subscriptionId: string; reason: string; adminUserId: string }, now: Date = new Date()): Promise<RefundRecord> {
    if (!params.reason?.trim()) {
      throw new BadRequestException('A refund requires a reason.');
    }

    const subscription = await this.subscriptionRepository.findById(params.subscriptionId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found.');
    }
    if (subscription.status === 'REFUNDED') {
      throw new ConflictException('This subscription has already been refunded.');
    }

    const alreadyRefunded = await this.refundRepository.hasAnyForSubscription(subscription.id);
    if (alreadyRefunded) {
      throw new ConflictException('A refund has already been issued for this subscription.');
    }

    const windowDays = this.config.get<number>('billing.refundWindowDays', 7);
    const windowEnd = new Date(subscription.createdAt.getTime() + windowDays * 24 * 60 * 60 * 1000);
    if (now > windowEnd) {
      throw new ConflictException(`The ${windowDays}-day refund window for this subscription has passed.`);
    }

    const plan = getPlanDefinition(subscription.planCode);

    const refund = await this.refundRepository.create({
      subscriptionId: subscription.id,
      userId: subscription.userId,
      amountCents: plan.priceCents,
      currency: plan.currency,
      reason: params.reason.trim(),
      requestedBy: params.adminUserId,
    });

    await this.ledger.record({
      eventType: 'REFUND_REQUESTED',
      userId: subscription.userId,
      customerId: subscription.paddleCustomerId,
      subscriptionId: subscription.id,
      checkoutId: null,
      paymentId: null,
      planCode: subscription.planCode as unknown as PrismaPlanCode,
      amountCents: plan.priceCents,
      currency: plan.currency,
      status: BillingLedgerStatus.PENDING,
      reason: params.reason,
      actorType: 'ADMIN',
      actorId: params.adminUserId,
      correlationId: refund.id,
    });

    // Paddle's own adjustment-processing confirmation (adjustment.created) is the authoritative
    // final state — see WebhookProcessingService.handleAdjustmentCreated. This synchronous call
    // requests it; Subscription.refund() and Refund.status=ISSUED are only finalized once that
    // webhook lands, never here, matching "never activate/finalize a paid-entitlement-affecting
    // outcome based only on a synchronous API response."
    try {
      await this.paymentProvider.issueRefund({
        providerTransactionId: subscription.paddleSubscriptionId,
        amountCents: plan.priceCents,
        reason: params.reason,
      });
    } catch (error) {
      await this.refundRepository.markRejected(refund.id, now);
      await this.ledger.record({
        eventType: 'REFUND_REJECTED',
        userId: subscription.userId,
        customerId: subscription.paddleCustomerId,
        subscriptionId: subscription.id,
        checkoutId: null,
        paymentId: null,
        planCode: subscription.planCode as unknown as PrismaPlanCode,
        amountCents: plan.priceCents,
        currency: plan.currency,
        status: BillingLedgerStatus.FAILURE,
        reason: error instanceof Error ? error.message : 'Unknown provider error.',
        actorType: 'ADMIN',
        actorId: params.adminUserId,
        correlationId: refund.id,
      });
      throw error;
    }

    return refund;
  }
}
