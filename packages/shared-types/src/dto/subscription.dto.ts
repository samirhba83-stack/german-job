import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { PlanCode } from '../enums/plan-code.enum';

export interface SubscriptionDto {
  id: string;
  planCode: PlanCode;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  pastDueSince: string | null;
  gracePeriodEndsAt: string | null;
  refundedAt: string | null;
  createdAt: string;
}
