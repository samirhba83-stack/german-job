'use client';

import { useQuery } from '@tanstack/react-query';
import * as billingApi from '../api/billing.api';

/** Real `GET /billing/ledger` — the current user's real payment/subscription event history. */
export function useBillingLedger(limit = 50) {
  return useQuery({
    queryKey: ['billing', 'ledger', limit],
    queryFn: () => billingApi.getLedger(limit),
  });
}
