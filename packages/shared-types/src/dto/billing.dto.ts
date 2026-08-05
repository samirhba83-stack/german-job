import { PlanCode } from '../enums/plan-code.enum';
import { FeatureEntitlement } from '../enums/feature-entitlement.enum';
import { SubscriptionDto } from './subscription.dto';

/** Public, marketing-facing view of one plan — the frontend pricing page renders exactly this,
 * never hardcoded copy. Deliberately separates commercial data (price/limits) from marketing
 * copy (purpose/customerOutcomes) even within one DTO, matching "never mix business logic with
 * marketing copy" at the type level. */
export interface PlanLimitsDto {
  activeCampaigns: number;
  companiesPerMonth: number | null;
  deliveriesPerMonth: number | null;
  specializations: number;
  storageBytes: number;
}

export interface PlanCatalogueEntryDto {
  code: PlanCode;
  displayName: string;
  priceCents: number;
  currency: 'EUR';
  billingInterval: 'MONTHLY';
  purpose: string;
  customerOutcomes: string[];
  featureHighlights: string[];
  limits: PlanLimitsDto;
  entitlements: FeatureEntitlement[];
  paddlePriceId: string | null;
}

/** What the current user can actually do right now — the one authoritative entitlement view,
 * consumed by the frontend to gate UI and explain state, and structurally identical to what the
 * backend's own centralized entitlement projection computes server-side (never trust a
 * client-side copy of this for real enforcement). */
export interface EntitlementSummaryDto {
  planCode: PlanCode;
  entitlements: FeatureEntitlement[];
  limits: PlanLimitsDto;
  usage: {
    activeCampaigns: number;
    companiesThisPeriod: number;
    deliveriesThisPeriod: number;
    storageBytes: number;
  };
  canStartNewExecution: boolean;
}

/** Everything the Billing Workspace needs in one call: current subscription (null if FREE),
 * entitlement summary, and a short explanation of current state. */
export interface BillingStatusDto {
  subscription: SubscriptionDto | null;
  entitlements: EntitlementSummaryDto;
  explanation: string;
}

export interface CreateCheckoutSessionRequestDto {
  planCode: PlanCode;
  idempotencyKey: string;
}

/** The minimum safe checkout response — never a price, never a provider price id, never an
 * entitlement level (Phase 4: "Backend returns only the minimum safe checkout response"). */
export interface CheckoutSessionResponseDto {
  checkoutUrl: string;
  expiresAt: string;
}

export interface BillingLedgerEntryDto {
  id: string;
  eventType: string;
  planCode: PlanCode | null;
  amountCents: number | null;
  currency: string | null;
  status: string;
  reason: string | null;
  occurredAt: string;
}

export interface RefundRequestDto {
  reason: string;
}

export interface RefundDto {
  id: string;
  amountCents: number;
  currency: string;
  reason: string;
  status: string;
  createdAt: string;
  processedAt: string | null;
}
