/** M27 — the stable internal identifier for a commercial plan. The full plan definition (price,
 * limits, entitlements, marketing copy) lives in exactly one place:
 * apps/api/src/modules/billing/domain/plan-catalogue.ts — never duplicated here or in the
 * frontend. FREE is included for catalogue/API consistency even though no Subscription row is
 * ever persisted for it (see the Prisma schema's own doc comment on PlanCode). */
export enum PlanCode {
  FREE = 'FREE',
  PROFESSIONAL = 'PROFESSIONAL',
  PREMIUM = 'PREMIUM',
  ENTERPRISE = 'ENTERPRISE',
}
