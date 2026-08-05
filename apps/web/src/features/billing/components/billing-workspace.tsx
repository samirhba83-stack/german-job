'use client';

import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ContextHeader } from '@/components/shell/context-header';
import { TrustFeedbackCard } from '@/components/shell/trust-feedback-card';
import { ErrorState } from '@/components/shell/error-state';
import { ApiError } from '@/lib/api-client';
import { SUBSCRIPTION_STATUS_TONE, humanizeStatus } from '@/lib/status-mappings';
import { usePlans } from '../hooks/use-plans';
import { useBillingStatus } from '../hooks/use-billing-status';
import { useBillingLedger } from '../hooks/use-billing-ledger';
import { useBillingActions } from '../hooks/use-billing-actions';
import { BillingHero } from './billing-hero';
import { PlanCatalogue } from './plan-catalogue';
import { PlanComparisonTable } from './plan-comparison-table';
import { SubscriptionStatusCard } from './subscription-status-card';
import { UsageLimitsPanel } from './usage-limits-panel';
import { BillingLedgerList } from './billing-ledger-list';
import type { PlanCode } from '../types';

function WorkspaceSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-heading-md font-semibold text-primary">{title}</h2>
      {children}
    </section>
  );
}

/**
 * The Billing Workspace (Milestone 27, Phase 13) — real plan comparison, checkout, subscription
 * status, usage/limits, and payment history, composed from `GET /billing/{plans,status,ledger}`.
 * No fake invoices, no fake payment success, no fake usage, no fabricated countdowns: the
 * "payment received" state after a checkout redirect polls the real status until a subscription
 * genuinely appears (`useBillingStatus({ pollUntilSettled: true })`) rather than claiming success
 * before Paddle's webhook has actually landed.
 */
export function BillingWorkspace() {
  const searchParams = useSearchParams();
  const checkoutParam = searchParams.get('checkout'); // 'success' | 'canceled' | null
  // Captured once on mount so navigating away and back (or the query resolving) doesn't flip
  // polling on and off mid-session.
  const [checkoutJustCompleted] = useState(() => checkoutParam === 'success');

  const plansQuery = usePlans();
  const statusQuery = useBillingStatus({ pollUntilSettled: checkoutJustCompleted });
  const ledgerQuery = useBillingLedger();
  const { checkout, cancel, resume, changePlan } = useBillingActions();

  const [pendingPlanCode, setPendingPlanCode] = useState<PlanCode | null>(null);

  function handleUpgrade(planCode: PlanCode) {
    setPendingPlanCode(planCode);
    checkout.mutate(
      { planCode, idempotencyKey: crypto.randomUUID() },
      {
        onSuccess: (result) => {
          window.location.href = result.checkoutUrl;
        },
        onError: () => setPendingPlanCode(null),
      },
    );
  }

  function handleSwitchPlan(planCode: PlanCode) {
    setPendingPlanCode(planCode);
    changePlan.mutate(planCode, { onSettled: () => setPendingPlanCode(null) });
  }

  if (statusQuery.isLoading || plansQuery.isLoading) {
    return (
      // M27.5: shape-matches the real layout below (hero / status / usage / 4 plan cards) instead
      // of two generic bars — the Skeleton component's own stated design principle
      // ("shape-matching loading pattern"), just not previously followed on this page.
      <SkeletonRegion loading label="Loading billing">
        <div className="space-y-8">
          <Skeleton variant="card" className="h-24" />
          <Skeleton variant="card" className="h-28" />
          <Skeleton variant="card" className="h-40" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="card" className="h-80" />
            ))}
          </div>
        </div>
      </SkeletonRegion>
    );
  }

  if (statusQuery.isError || !statusQuery.data || plansQuery.isError || !plansQuery.data) {
    return (
      <ErrorState
        message={statusQuery.error instanceof ApiError ? statusQuery.error.message : 'Billing information could not be loaded. Please try again in a moment.'}
      />
    );
  }

  const { subscription, entitlements, explanation } = statusQuery.data;
  const currentPlan = plansQuery.data.find((plan) => plan.code === entitlements.planCode);

  return (
    <div className="space-y-8">
      <ContextHeader
        title="Billing"
        status={
          <Badge tone={subscription ? SUBSCRIPTION_STATUS_TONE[subscription.status] : 'neutral'}>
            {humanizeStatus(entitlements.planCode)}
          </Badge>
        }
      />

      {currentPlan && <BillingHero currentPlan={currentPlan} />}

      {checkoutParam === 'success' && (
        <TrustFeedbackCard
          label={subscription ? 'Subscription active' : 'Payment received'}
          tone={subscription ? 'positive' : 'info'}
          explanation={
            subscription
              ? `Your ${humanizeStatus(subscription.planCode)} subscription is now active.`
              : "Finalizing your subscription — this usually takes a few seconds while we confirm the payment with Paddle."
          }
        />
      )}
      {checkoutParam === 'canceled' && (
        <TrustFeedbackCard label="Checkout canceled" tone="neutral" explanation="You canceled checkout — no charge was made." />
      )}

      <SubscriptionStatusCard
        subscription={subscription}
        explanation={explanation}
        onCancel={(reason) => cancel.mutate(reason)}
        onResume={() => resume.mutate(undefined)}
        cancelPending={cancel.isPending}
        resumePending={resume.isPending}
      />

      <UsageLimitsPanel entitlements={entitlements} />

      <WorkspaceSection title="Plans">
        <PlanCatalogue
          plans={plansQuery.data}
          currentPlanCode={entitlements.planCode}
          subscription={subscription}
          onUpgrade={handleUpgrade}
          onSwitchPlan={handleSwitchPlan}
          pendingPlanCode={pendingPlanCode}
        />
      </WorkspaceSection>

      <WorkspaceSection title="Compare plans in detail">
        <PlanComparisonTable plans={plansQuery.data} currentPlanCode={entitlements.planCode} />
      </WorkspaceSection>

      <WorkspaceSection title="Billing history">
        <SkeletonRegion loading={ledgerQuery.isLoading} label="Loading billing history">
          {ledgerQuery.data ? (
            <BillingLedgerList entries={ledgerQuery.data} />
          ) : ledgerQuery.isError ? (
            <p className="text-body-sm text-secondary">Billing history is unavailable right now.</p>
          ) : (
            <Skeleton variant="card" className="h-32" />
          )}
        </SkeletonRegion>
      </WorkspaceSection>
    </div>
  );
}
