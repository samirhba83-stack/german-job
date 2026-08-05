'use client';

import { useQuery } from '@tanstack/react-query';
import * as billingApi from '../api/billing.api';

/**
 * Real `GET /billing/status` — the one authoritative view of the current user's subscription,
 * entitlements, and usage.
 *
 * `pollUntilSettled`: after a checkout redirect lands the user back on `/billing?checkout=success`,
 * activation depends on Paddle's async webhook arriving — there is no synchronous "payment
 * succeeded, plan is active" signal at redirect time. Rather than fabricate a fake countdown or
 * claim success before it's real, this polls the real status every 2.5s until a subscription
 * actually appears, and TanStack Query's own `refetchInterval` function form stops polling itself
 * the moment that's true — no separate timer/cleanup code needed.
 */
export function useBillingStatus(options: { pollUntilSettled?: boolean } = {}) {
  return useQuery({
    queryKey: ['billing', 'status'],
    queryFn: billingApi.getBillingStatus,
    refetchInterval: options.pollUntilSettled
      ? (query) => (query.state.data?.subscription ? false : 2500)
      : undefined,
  });
}
