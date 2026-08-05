'use client';

import { useQuery } from '@tanstack/react-query';
import * as billingApi from '../api/billing.api';

/** Real `GET /billing/plans` — public pricing catalogue. Longer `staleTime` than the platform
 * default (30s): prices/limits/copy only change on a deploy, never per-request, so refetching
 * this every 30s on window focus would be pure waste. */
export function usePlans() {
  return useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: billingApi.getPlans,
    staleTime: 5 * 60_000,
  });
}
