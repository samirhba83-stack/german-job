/** M27 — capabilities represented as backend entitlements rather than plan-specific hardcoded
 * checks scattered through the codebase. Not every entitlement gates a real endpoint yet — see
 * apps/api/src/modules/billing/domain/plan-catalogue.ts's own doc comment for exactly which
 * ones are load-bearing today (CAN_PRODUCTION_EXECUTE and the numeric plan limits) versus
 * correctly-computed-but-not-yet-gating-anything (multi-user, exports, decision intelligence UI,
 * priority support) because the underlying feature doesn't exist in the product yet — named
 * honestly, not hidden, matching this project's standing discipline for reserved-but-unpopulated
 * fields (e.g. CampaignDto.health).
 */
export enum FeatureEntitlement {
  CAN_PRODUCTION_EXECUTE = 'CAN_PRODUCTION_EXECUTE',
  CAN_PERSONALIZE_CV = 'CAN_PERSONALIZE_CV',
  CAN_PERSONALIZE_MOTIVATION_LETTER = 'CAN_PERSONALIZE_MOTIVATION_LETTER',
  CAN_SMART_APPLICATION_MATCHING = 'CAN_SMART_APPLICATION_MATCHING',
  CAN_SMART_EXECUTION_TIMING = 'CAN_SMART_EXECUTION_TIMING',
  CAN_DELIVERABILITY_PROTECTION = 'CAN_DELIVERABILITY_PROTECTION',
  CAN_DUPLICATE_PREVENTION = 'CAN_DUPLICATE_PREVENTION',
  CAN_EXECUTION_TRACKING = 'CAN_EXECUTION_TRACKING',
  CAN_ADVANCED_ANALYTICS = 'CAN_ADVANCED_ANALYTICS',
  CAN_DECISION_INTELLIGENCE = 'CAN_DECISION_INTELLIGENCE',
  CAN_MULTI_SPECIALIZATION = 'CAN_MULTI_SPECIALIZATION',
  CAN_MULTI_USER = 'CAN_MULTI_USER',
  CAN_EXPORT_REPORTS = 'CAN_EXPORT_REPORTS',
  CAN_PRIORITY_SUPPORT = 'CAN_PRIORITY_SUPPORT',
}
