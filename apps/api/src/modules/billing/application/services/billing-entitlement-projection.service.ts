import { Inject, Injectable } from '@nestjs/common';
import { FeatureEntitlement, PlanCode, SubscriptionStatus } from '@german-job-engine/shared-types';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { SUBSCRIPTION_REPOSITORY, SubscriptionRepository } from '../../domain/repositories/subscription.repository.interface';
import { getPlanDefinition, PlanLimits } from '../../domain/plan-catalogue';

/** Campaign statuses that no longer occupy an "active campaign" slot — mirrors
 * Campaign.entity.ts's own TERMINAL_STATES exactly (COMPLETED/CANCELLED/ARCHIVED; STOPPED is
 * deliberately NOT terminal there — resumable — so it still counts here too). */
const CAMPAIGN_TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'ARCHIVED'] as const;

export interface EntitlementSummary {
  readonly planCode: PlanCode;
  readonly entitlements: ReadonlyArray<FeatureEntitlement>;
  readonly limits: PlanLimits;
  readonly usage: {
    readonly activeCampaigns: number;
    readonly companiesThisPeriod: number;
    readonly deliveriesThisPeriod: number;
    readonly storageBytes: number;
  };
  readonly canStartNewExecution: boolean;
  readonly isPastDue: boolean;
  readonly periodStart: Date | null;
  readonly periodEnd: Date | null;
}

/**
 * M27 Phase 8 — the ONE authoritative entitlement authority. Every other place that needs to
 * know "what can this user do right now" (SubscriptionEligibilitySpecification's context
 * builder, campaign/target creation limits, the Billing Workspace, future admin tooling) calls
 * this service rather than independently re-deriving subscription state — matching "keep
 * entitlement evaluation centralized, do not scatter billing checks across controllers and
 * workers."
 *
 * Effective plan resolution (real product behavior, not raw provider status strings):
 *  - No current Subscription row -> FREE.
 *  - ACTIVE -> that subscription's real plan.
 *  - PAST_DUE, still within its grace window -> the plan is retained (Phase 10: do not instantly
 *    restrict), but isPastDue is surfaced so the UI/notifications can warn.
 *  - PAST_DUE, grace window elapsed (a defensive case — the real path is a webhook or the
 *    reconciliation job moving this to CANCELED before this would ever be observed) -> FREE.
 *  - CANCEL_AT_PERIOD_END, still before currentPeriodEnd -> the plan is retained (the approved
 *    policy: "Cancellation: Effective at period end").
 *  - CANCELED / REFUNDED, or CANCEL_AT_PERIOD_END past its period end (defensive) -> FREE.
 */
@Injectable()
export class BillingEntitlementProjectionService {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptionRepository: SubscriptionRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getEntitlementSummary(userId: string, now: Date = new Date()): Promise<EntitlementSummary> {
    const subscription = await this.subscriptionRepository.findCurrentByUserId(userId);

    let effectivePlanCode: PlanCode = PlanCode.FREE;
    let isPastDue = false;
    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;

    if (subscription) {
      const withinGrace = subscription.status === SubscriptionStatus.PAST_DUE && (!subscription.gracePeriodEndsAt || now < subscription.gracePeriodEndsAt);
      const withinScheduledCancellation = subscription.status === SubscriptionStatus.CANCEL_AT_PERIOD_END && now < subscription.currentPeriodEnd;

      if (subscription.status === SubscriptionStatus.ACTIVE || withinGrace || withinScheduledCancellation) {
        effectivePlanCode = subscription.planCode;
        periodStart = subscription.currentPeriodStart;
        periodEnd = subscription.currentPeriodEnd;
        isPastDue = subscription.status === SubscriptionStatus.PAST_DUE;
      }
    }

    const plan = getPlanDefinition(effectivePlanCode);
    const usage = await this.computeUsage(userId, periodStart);

    return {
      planCode: effectivePlanCode,
      // Plan/features/limits stay visible during a PAST_DUE grace period (Phase 10: "permission
      // to view historical data" and plan context is never yanked mid-grace) — only the ability
      // to start NEW execution is gated separately below, since a failed payment is a distinct,
      // higher-risk signal than a voluntary end-of-period cancellation (which keeps full access,
      // execution included, through the paid period by explicit policy).
      entitlements: plan.entitlements,
      limits: plan.limits,
      usage,
      canStartNewExecution: plan.entitlements.includes(FeatureEntitlement.CAN_PRODUCTION_EXECUTE) && !isPastDue,
      isPastDue,
      periodStart,
      periodEnd,
    };
  }

  async hasEntitlement(userId: string, entitlement: FeatureEntitlement): Promise<boolean> {
    const summary = await this.getEntitlementSummary(userId);
    return summary.entitlements.includes(entitlement);
  }

  /** Real usage, computed by counting already-real, already-persisted rows — never a separate
   * counter that could drift from the data it's supposed to represent (see the M27 engineering
   * report's "Usage Model" section for the rationale). `periodStart` null means the user has no
   * current paid period (FREE tier) — usage is counted all-time in that case, matching FREE's
   * limits being absolute caps rather than monthly ones (see plan-catalogue.ts). */
  private async computeUsage(userId: string, periodStart: Date | null): Promise<EntitlementSummary['usage']> {
    const [activeCampaigns, companiesThisPeriod, deliveriesThisPeriod, profile] = await Promise.all([
      this.prisma.campaign.count({
        where: { ownerId: userId, status: { notIn: [...CAMPAIGN_TERMINAL_STATUSES] } },
      }),
      this.prisma.campaignTarget.count({
        where: {
          campaign: { ownerId: userId },
          ...(periodStart ? { addedAt: { gte: periodStart } } : {}),
        },
      }),
      this.prisma.dispatchAttempt.count({
        where: {
          target: { campaign: { ownerId: userId } },
          outcome: 'SUCCEEDED',
          ...(periodStart ? { attemptedAt: { gte: periodStart } } : {}),
        },
      }),
      this.prisma.userProfile.findUnique({ where: { userId }, select: { cvSizeBytes: true, photoSizeBytes: true } }),
    ]);

    return {
      activeCampaigns,
      companiesThisPeriod,
      deliveriesThisPeriod,
      storageBytes: (profile?.cvSizeBytes ?? 0) + (profile?.photoSizeBytes ?? 0),
    };
  }
}
