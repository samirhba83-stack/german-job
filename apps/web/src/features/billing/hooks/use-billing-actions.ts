'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTrackedMutation } from '@/lib/hooks/use-tracked-mutation';
import * as billingApi from '../api/billing.api';
import type { PlanCode } from '../types';

/**
 * Every real billing write the workspace exposes, wired through `useTrackedMutation` — same
 * Background Activity Center + toast pattern as every other mutation in the product
 * (`useCampaignActions`). `checkout` deliberately has no `successMessage`/query invalidation of
 * its own: it navigates the browser away to Paddle's hosted checkout page on success
 * (`BillingWorkspace`'s `onSuccess`), so there's nothing left on this page to acknowledge or
 * refresh.
 */
export function useBillingActions() {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['billing', 'status'] });
    queryClient.invalidateQueries({ queryKey: ['billing', 'ledger'] });
  }

  const checkout = useTrackedMutation({
    activityLabel: 'Starting checkout',
    mutationFn: ({ planCode, idempotencyKey }: { planCode: PlanCode; idempotencyKey: string }) =>
      billingApi.startCheckout(planCode, idempotencyKey),
  });

  const cancel = useTrackedMutation({
    activityLabel: 'Scheduling cancellation',
    successMessage: 'Cancellation scheduled for the end of your billing period',
    mutationFn: (reason: string | undefined) => billingApi.cancelSubscription(reason),
    onSuccess: invalidate,
  });

  const resume = useTrackedMutation({
    activityLabel: 'Resuming subscription',
    successMessage: 'Cancellation undone — your subscription will continue',
    mutationFn: () => billingApi.resumeSubscription(),
    onSuccess: invalidate,
  });

  const changePlan = useTrackedMutation({
    activityLabel: 'Changing plan',
    successMessage: 'Plan updated',
    mutationFn: (planCode: PlanCode) => billingApi.changePlan(planCode),
    onSuccess: invalidate,
  });

  return { checkout, cancel, resume, changePlan };
}
