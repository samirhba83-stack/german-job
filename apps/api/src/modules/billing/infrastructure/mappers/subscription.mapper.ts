import { Subscription as PrismaSubscription } from '@german-job-engine/database';
import { PlanCode, SubscriptionStatus } from '@german-job-engine/shared-types';
import { Subscription, SubscriptionProps } from '../../domain/entities/subscription.entity';

// Prisma's generated enums are structural string-literal types, not the same nominal TS enums
// shared-types declares (even though every member's string VALUE is identical by construction —
// both are generated from the same source names). The cast here is the one, single, deliberate
// crossing point between the two representations for this aggregate — every other file in the
// billing module works with one or the other, never both.
export class SubscriptionMapper {
  static toDomain(raw: PrismaSubscription): Subscription {
    const props: SubscriptionProps = {
      userId: raw.userId,
      planCode: raw.planCode as unknown as PlanCode,
      status: raw.status as unknown as SubscriptionStatus,
      paddleSubscriptionId: raw.paddleSubscriptionId,
      paddleCustomerId: raw.paddleCustomerId,
      currentPeriodStart: raw.currentPeriodStart,
      currentPeriodEnd: raw.currentPeriodEnd,
      cancelAtPeriodEnd: raw.cancelAtPeriodEnd,
      canceledAt: raw.canceledAt,
      cancellationReason: raw.cancellationReason,
      pastDueSince: raw.pastDueSince,
      gracePeriodEndsAt: raw.gracePeriodEndsAt,
      refundedAt: raw.refundedAt,
      disputedAt: raw.disputedAt,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
    return Subscription.reconstitute(raw.id, props);
  }

  static toPersistence(subscription: Subscription): Omit<PrismaSubscription, 'id'> & { id: string } {
    return {
      id: subscription.id,
      userId: subscription.userId,
      planCode: subscription.planCode as unknown as PrismaSubscription['planCode'],
      status: subscription.status as unknown as PrismaSubscription['status'],
      paddleSubscriptionId: subscription.paddleSubscriptionId,
      paddleCustomerId: subscription.paddleCustomerId,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      canceledAt: subscription.canceledAt,
      cancellationReason: subscription.cancellationReason,
      pastDueSince: subscription.pastDueSince,
      gracePeriodEndsAt: subscription.gracePeriodEndsAt,
      refundedAt: subscription.refundedAt,
      disputedAt: subscription.disputedAt,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }
}
