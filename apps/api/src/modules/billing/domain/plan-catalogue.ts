import { PlanCode, FeatureEntitlement } from '@german-job-engine/shared-types';

/**
 * M27 — the single, authoritative source of truth for the commercial model. Every price, limit,
 * entitlement, and piece of marketing copy anywhere in the product (checkout, webhooks,
 * entitlement enforcement, the public pricing page, invoices) is derived from this file — never
 * duplicated in the frontend, a database row, or Paddle's own dashboard config. This exact
 * catalogue (names, prices, limits, marketing copy) was supplied directly by the product owner,
 * not invented.
 *
 * `paddlePriceId` intentionally resolves from environment variables, not a literal here — the
 * mapping from an internal PlanCode to Paddle's own price identity is deployment configuration
 * (sandbox vs. production have different Paddle price IDs), never domain truth. A paid plan with
 * no configured price ID fails checkout closed (see CheckoutService) rather than silently using
 * a wrong or stale identifier.
 */

export interface PlanLimits {
  readonly activeCampaigns: number;
  /** null = not applicable (FREE never executes, so it has no monthly production caps). */
  readonly companiesPerMonth: number | null;
  readonly deliveriesPerMonth: number | null;
  readonly specializations: number;
  readonly storageBytes: number;
}

export interface PlanDefinition {
  readonly code: PlanCode;
  readonly displayName: string;
  /** Business logic — never read by marketing copy, never duplicated. */
  readonly priceCents: number;
  readonly currency: 'EUR';
  readonly billingInterval: 'MONTHLY';
  readonly limits: PlanLimits;
  readonly entitlements: ReadonlyArray<FeatureEntitlement>;
  /** Marketing copy — structurally separate from the business-logic fields above, exactly as
   * required ("never mix business logic with marketing copy"). Never consulted by any
   * enforcement code path. */
  readonly purpose: string;
  readonly customerOutcomes: ReadonlyArray<string>;
  readonly featureHighlights: ReadonlyArray<string>;
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

const FREE: PlanDefinition = {
  code: PlanCode.FREE,
  displayName: 'Free',
  priceCents: 0,
  currency: 'EUR',
  billingInterval: 'MONTHLY',
  limits: {
    activeCampaigns: 1,
    // FREE has no recurring billing period (no Subscription row exists for it at all — see this
    // file's own header comment), so "5 target companies" is enforced as an absolute, all-time
    // count rather than a monthly one (see BillingEntitlementProjectionService's usage-counting
    // logic, which counts all-time for users with no current subscription).
    companiesPerMonth: 5,
    // Not a numeric cap — CAN_PRODUCTION_EXECUTE's absence is what makes deliveries impossible
    // on FREE ("No production execution"), so there is no separate delivery count to enforce.
    deliveriesPerMonth: null,
    specializations: 1,
    storageBytes: 500 * MB,
  },
  entitlements: [],
  purpose: 'Prepare your professional profile before applying.',
  customerOutcomes: [
    'Build your professional German profile',
    'Check CV readiness',
    'Discover companies',
    'Preview AI personalization',
    'Understand how campaigns work',
    'Improve application quality before paying',
  ],
  featureHighlights: [
    'CV preparation',
    'Basic profile analysis',
    'Company discovery',
    'Campaign preview',
    'Application preview',
    'Basic recommendations',
  ],
};

const PROFESSIONAL: PlanDefinition = {
  code: PlanCode.PROFESSIONAL,
  displayName: 'Professional',
  priceCents: 4900,
  currency: 'EUR',
  billingInterval: 'MONTHLY',
  limits: {
    activeCampaigns: 2,
    companiesPerMonth: 150,
    deliveriesPerMonth: 150,
    specializations: 1,
    storageBytes: 1 * GB,
  },
  entitlements: [
    FeatureEntitlement.CAN_PRODUCTION_EXECUTE,
    FeatureEntitlement.CAN_PERSONALIZE_CV,
    FeatureEntitlement.CAN_PERSONALIZE_MOTIVATION_LETTER,
    FeatureEntitlement.CAN_SMART_APPLICATION_MATCHING,
    FeatureEntitlement.CAN_SMART_EXECUTION_TIMING,
    FeatureEntitlement.CAN_DUPLICATE_PREVENTION,
    FeatureEntitlement.CAN_DELIVERABILITY_PROTECTION,
    FeatureEntitlement.CAN_EXECUTION_TRACKING,
  ],
  purpose: 'Apply professionally for one career path.',
  customerOutcomes: [
    'Every application adapted to each company',
    'Better application quality',
    'Strategic sending times',
    'Avoid duplicate applications',
    'Monitor campaign progress',
    'Save hours of manual work',
  ],
  featureHighlights: [
    'Production execution',
    'Company-specific CV personalization',
    'Company-specific Motivation Letter',
    'Smart application adaptation',
    'Strategic German business-hour scheduling',
    'Duplicate prevention',
    'Deliverability protection',
    'Basic execution monitoring',
    'Campaign analytics',
    'Application tracking',
  ],
};

const PREMIUM: PlanDefinition = {
  code: PlanCode.PREMIUM,
  displayName: 'Premium',
  priceCents: 12000,
  currency: 'EUR',
  billingInterval: 'MONTHLY',
  limits: {
    activeCampaigns: 10,
    companiesPerMonth: 750,
    deliveriesPerMonth: 750,
    specializations: 2,
    storageBytes: 5 * GB,
  },
  entitlements: [
    ...PROFESSIONAL.entitlements,
    FeatureEntitlement.CAN_MULTI_SPECIALIZATION,
    FeatureEntitlement.CAN_DECISION_INTELLIGENCE,
    FeatureEntitlement.CAN_ADVANCED_ANALYTICS,
    FeatureEntitlement.CAN_PRIORITY_SUPPORT,
  ],
  purpose: 'Maximize interview opportunities.',
  customerOutcomes: [
    'Run two different career strategies simultaneously',
    'Let AI prioritize companies',
    'Receive intelligent execution decisions',
    'Optimize campaigns automatically',
    'Understand why every decision is made',
    'Increase success through continuous optimization',
  ],
  featureHighlights: [
    ...PROFESSIONAL.featureHighlights,
    'Dual-specialization execution',
    'Separate strategy for each specialization',
    'Advanced Decision Intelligence',
    'Smart company prioritization',
    'Advanced recommendations',
    'Adaptive batch sizing',
    'Smart execution timing',
    'Deliverability monitoring',
    'Spam-risk protection',
    'Intelligent campaign optimization',
    'Mission Control',
    'Advanced analytics',
    'Priority support',
  ],
};

const ENTERPRISE: PlanDefinition = {
  code: PlanCode.ENTERPRISE,
  displayName: 'Enterprise',
  priceCents: 50000,
  currency: 'EUR',
  billingInterval: 'MONTHLY',
  limits: {
    activeCampaigns: 50,
    companiesPerMonth: 5000,
    deliveriesPerMonth: 5000,
    // Not explicitly specified in the approved commercial model for Enterprise (only
    // Professional's "1 specialization" and Premium's "2 simultaneous specializations" were
    // given numbers). Carried forward from Premium rather than invented upward, since Enterprise
    // is defined as "Everything from Premium plus" team/org capabilities, not a stated increase
    // in per-candidate specialization count. Flagged in the M27 engineering report as an
    // explicit assumption to confirm, not silently guessed.
    specializations: 2,
    storageBytes: 25 * GB,
  },
  entitlements: [...PREMIUM.entitlements, FeatureEntitlement.CAN_MULTI_USER, FeatureEntitlement.CAN_EXPORT_REPORTS],
  purpose: 'Professional organizations managing multiple candidates.',
  customerOutcomes: [
    'Manage teams',
    'Manage multiple candidates',
    'Centralize operations',
    'Review before sending',
    'Generate operational reports',
    'Scale recruitment activities',
  ],
  featureHighlights: [
    ...PREMIUM.featureHighlights,
    'Multi-user workspace',
    'Administrative roles',
    'Multi-candidate support',
    'Approval workflow',
    'Team reporting',
    'Audit history',
    'Advanced exports',
    'Operational dashboards',
    'Contract-based scaling',
  ],
};

export const PLAN_CATALOGUE: Readonly<Record<PlanCode, PlanDefinition>> = {
  [PlanCode.FREE]: FREE,
  [PlanCode.PROFESSIONAL]: PROFESSIONAL,
  [PlanCode.PREMIUM]: PREMIUM,
  [PlanCode.ENTERPRISE]: ENTERPRISE,
};

/** Paid plans only — FREE never has a Paddle price or a checkout flow. */
export const PAID_PLAN_CODES: ReadonlyArray<PlanCode> = [PlanCode.PROFESSIONAL, PlanCode.PREMIUM, PlanCode.ENTERPRISE];

export function getPlanDefinition(code: PlanCode): PlanDefinition {
  return PLAN_CATALOGUE[code];
}

export function isPaidPlan(code: PlanCode): boolean {
  return code !== PlanCode.FREE;
}
