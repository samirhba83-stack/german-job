import { apiClient } from '@/lib/api-client';
import type { BillingLedgerEntryDto, BillingStatusDto, PlanCatalogueEntryDto, PlanCode } from '../types';

/** GET /billing/plans — public, real server-side pricing/limits/marketing copy
 * (`PLAN_CATALOGUE`, the one commercial source of truth); never hardcoded on the frontend. */
export async function getPlans(): Promise<PlanCatalogueEntryDto[]> {
  return apiClient<PlanCatalogueEntryDto[]>('/billing/plans');
}

/** GET /billing/status — the current user's real subscription, entitlements, usage, and a
 * server-computed plain-language explanation of the current state. */
export async function getBillingStatus(): Promise<BillingStatusDto> {
  return apiClient<BillingStatusDto>('/billing/status');
}

/** POST /billing/checkout — `idempotencyKey` is generated once per checkout attempt by the
 * caller (`crypto.randomUUID()`) so a retried click can never create a second Paddle transaction. */
export async function startCheckout(planCode: PlanCode, idempotencyKey: string): Promise<{ checkoutUrl: string; expiresAt: string }> {
  return apiClient<{ checkoutUrl: string; expiresAt: string }>('/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ planCode, idempotencyKey }),
  });
}

/** POST /billing/cancel — always schedules cancellation at the end of the current billing
 * period; there is no immediate-cancel path for a user-initiated request. */
export async function cancelSubscription(reason?: string): Promise<void> {
  await apiClient<{ success: true }>('/billing/cancel', { method: 'POST', body: JSON.stringify({ reason }) });
}

/** POST /billing/resume — undoes a scheduled end-of-period cancellation before it takes effect. */
export async function resumeSubscription(): Promise<void> {
  await apiClient<{ success: true }>('/billing/resume', { method: 'POST' });
}

/** POST /billing/change-plan — upgrade or downgrade to a different paid plan. */
export async function changePlan(planCode: PlanCode): Promise<void> {
  await apiClient<{ success: true }>('/billing/change-plan', { method: 'POST', body: JSON.stringify({ planCode }) });
}

/** GET /billing/ledger — real payment/subscription event history for the current user. */
export async function getLedger(limit?: number): Promise<BillingLedgerEntryDto[]> {
  return apiClient<BillingLedgerEntryDto[]>(`/billing/ledger${limit ? `?limit=${limit}` : ''}`);
}
