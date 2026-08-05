'use client';

import { Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatPlanPrice } from '@/lib/format-currency';
import { formatBytes } from '@/lib/format-bytes';
import type { PlanCatalogueEntryDto, SubscriptionDto } from '../types';
import { PlanCode } from '../types';

interface PlanCatalogueProps {
  plans: PlanCatalogueEntryDto[];
  currentPlanCode: PlanCode;
  /** Real `billingStatus.subscription` — null means no active-ish paid subscription (FREE, or a
   * lapsed CANCELED/REFUNDED one, both of which the backend already resolves back to FREE). */
  subscription: SubscriptionDto | null;
  onUpgrade: (planCode: PlanCode) => void;
  onSwitchPlan: (planCode: PlanCode) => void;
  pendingPlanCode: PlanCode | null;
}

/** The one plan positioned as the natural middle-tier upsell — real copy from its own catalogue
 * entry ("Maximize interview opportunities"), not a fabricated popularity claim (no "10,000
 * customers chose this"). */
const RECOMMENDED_PLAN_CODE = PlanCode.PREMIUM;

/**
 * The public pricing grid — every price, limit, and feature is a real field from
 * `GET /billing/plans` (`PLAN_CATALOGUE`, the one commercial source of truth); nothing here is
 * hardcoded copy. Button behavior mirrors exactly what the backend will actually accept
 * (`CheckoutService`/`PlanChangeService`): FREE is never purchasable (no button, ever); switching
 * between paid plans only offers `changePlan` while the subscription is genuinely `ACTIVE` and not
 * already scheduled to cancel — any other real state (PAST_DUE, CANCEL_AT_PERIOD_END) disables the
 * action rather than let a click hit a guard the service would reject anyway.
 */
export function PlanCatalogue({ plans, currentPlanCode, subscription, onUpgrade, onSwitchPlan, pendingPlanCode }: PlanCatalogueProps) {
  const canSwitchPlans = subscription !== null && subscription.status === 'ACTIVE' && !subscription.cancelAtPeriodEnd;
  const currentPlanPriceCents = plans.find((plan) => plan.code === currentPlanCode)?.priceCents ?? 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {plans.map((plan) => {
        const isCurrent = plan.code === currentPlanCode;
        const isFree = plan.code === PlanCode.FREE;
        const isPending = pendingPlanCode === plan.code;
        const isRecommended = plan.code === RECOMMENDED_PLAN_CODE && !isCurrent;
        const isDowngrade = plan.priceCents < currentPlanPriceCents;

        return (
          <Card
            key={plan.code}
            padding="lg"
            className={cn(
              'flex flex-col gap-4 transition-shadow duration-base ease-standard hover:shadow-elevation-2',
              isCurrent && 'ring-2 ring-accent',
              isRecommended && 'ring-1 ring-accent/40',
            )}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-heading-md font-semibold text-primary">{plan.displayName}</h3>
                {isCurrent ? (
                  <Badge tone="info">Current plan</Badge>
                ) : isRecommended ? (
                  <Badge tone="positive">Recommended</Badge>
                ) : null}
              </div>
              <p className="text-heading-lg font-semibold text-primary tabular-nums">{formatPlanPrice(plan.priceCents)}</p>
              <p className="text-body-sm text-secondary">{plan.purpose}</p>
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-caption text-secondary">
              <dt>Active campaigns</dt>
              <dd className="text-right font-semibold text-primary tabular-nums">{plan.limits.activeCampaigns}</dd>
              <dt>Companies / mo</dt>
              <dd className="text-right font-semibold text-primary tabular-nums">{plan.limits.companiesPerMonth ?? '—'}</dd>
              <dt>Deliveries / mo</dt>
              <dd className="text-right font-semibold text-primary tabular-nums">{plan.limits.deliveriesPerMonth ?? '—'}</dd>
              <dt>Storage</dt>
              <dd className="text-right font-semibold text-primary tabular-nums">{formatBytes(plan.limits.storageBytes)}</dd>
            </dl>

            <ul className="flex-1 space-y-1.5">
              {plan.featureHighlights.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-body-sm text-primary">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-positive" aria-hidden="true" strokeWidth={2} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {isCurrent ? (
              <Button size="sm" variant="secondary" disabled className="w-full">
                Current plan
              </Button>
            ) : isFree ? (
              <p className="text-caption text-secondary">Included automatically if you cancel your paid plan.</p>
            ) : !subscription ? (
              <Button size="sm" loading={isPending} onClick={() => onUpgrade(plan.code)} className="w-full">
                Upgrade to {plan.displayName}
              </Button>
            ) : canSwitchPlans ? (
              <Button size="sm" variant="secondary" loading={isPending} onClick={() => onSwitchPlan(plan.code)} className="w-full">
                {isDowngrade ? 'Downgrade' : 'Upgrade'} to {plan.displayName}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled
                title="Resolve your current subscription status before changing plans"
                className="w-full"
              >
                {isDowngrade ? 'Downgrade' : 'Upgrade'} to {plan.displayName}
              </Button>
            )}
          </Card>
        );
      })}
    </div>
  );
}
