import { BillingLedgerEntryDto, BillingStatusDto, EntitlementSummaryDto, PlanCatalogueEntryDto, RefundDto, SubscriptionDto } from '@german-job-engine/shared-types';
import { Subscription } from '../domain/entities/subscription.entity';
import { PlanDefinition } from '../domain/plan-catalogue';
import { EntitlementSummary } from './services/billing-entitlement-projection.service';
import { RefundRecord } from '../infrastructure/persistence/prisma-refund.repository';

export class BillingResponseMapper {
  static toSubscriptionDto(subscription: Subscription): SubscriptionDto {
    return {
      id: subscription.id,
      planCode: subscription.planCode,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      canceledAt: subscription.canceledAt?.toISOString() ?? null,
      pastDueSince: subscription.pastDueSince?.toISOString() ?? null,
      gracePeriodEndsAt: subscription.gracePeriodEndsAt?.toISOString() ?? null,
      refundedAt: subscription.refundedAt?.toISOString() ?? null,
      createdAt: subscription.createdAt.toISOString(),
    };
  }

  static toEntitlementSummaryDto(summary: EntitlementSummary): EntitlementSummaryDto {
    return {
      planCode: summary.planCode,
      entitlements: [...summary.entitlements],
      limits: { ...summary.limits },
      usage: { ...summary.usage },
      canStartNewExecution: summary.canStartNewExecution,
    };
  }

  static toBillingStatusDto(subscription: Subscription | null, summary: EntitlementSummary): BillingStatusDto {
    return {
      subscription: subscription ? this.toSubscriptionDto(subscription) : null,
      entitlements: this.toEntitlementSummaryDto(summary),
      explanation: this.explain(subscription, summary),
    };
  }

  static toPlanCatalogueEntryDto(plan: PlanDefinition, paddlePriceId: string | null): PlanCatalogueEntryDto {
    return {
      code: plan.code,
      displayName: plan.displayName,
      priceCents: plan.priceCents,
      currency: plan.currency,
      billingInterval: plan.billingInterval,
      purpose: plan.purpose,
      customerOutcomes: [...plan.customerOutcomes],
      featureHighlights: [...plan.featureHighlights],
      limits: { ...plan.limits },
      entitlements: [...plan.entitlements],
      paddlePriceId,
    };
  }

  static toLedgerEntryDto(entry: {
    id: string;
    eventType: string;
    planCode: string | null;
    amountCents: number | null;
    currency: string | null;
    status: string;
    reason: string | null;
    occurredAt: Date;
  }): BillingLedgerEntryDto {
    return {
      id: entry.id,
      eventType: entry.eventType,
      planCode: (entry.planCode as BillingLedgerEntryDto['planCode']) ?? null,
      amountCents: entry.amountCents,
      currency: entry.currency,
      status: entry.status,
      reason: entry.reason,
      occurredAt: entry.occurredAt.toISOString(),
    };
  }

  static toRefundDto(refund: RefundRecord): RefundDto {
    return {
      id: refund.id,
      amountCents: refund.amountCents,
      currency: refund.currency,
      reason: refund.reason,
      status: refund.status,
      createdAt: refund.createdAt.toISOString(),
      processedAt: refund.processedAt?.toISOString() ?? null,
    };
  }

  private static explain(subscription: Subscription | null, summary: EntitlementSummary): string {
    if (!subscription) {
      return "You're on the Free plan. Upgrade to unlock production execution.";
    }
    if (summary.isPastDue) {
      const days = summary.periodEnd ? Math.max(0, Math.ceil((subscription.gracePeriodEndsAt!.getTime() - Date.now()) / 86_400_000)) : 0;
      return `Your last payment failed. You have ${days} day(s) to update your payment method before execution is paused.`;
    }
    if (subscription.cancelAtPeriodEnd) {
      return `Your subscription is set to end on ${subscription.currentPeriodEnd.toDateString()}. You'll keep full access until then.`;
    }
    if (subscription.status === 'CANCELED') {
      return "Your subscription has ended. You're now on the Free plan.";
    }
    if (subscription.status === 'REFUNDED') {
      return 'This subscription was refunded and access has ended.';
    }
    return `Your ${subscription.planCode} subscription is active and renews on ${subscription.currentPeriodEnd.toDateString()}.`;
  }
}
