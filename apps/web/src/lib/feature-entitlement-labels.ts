import { FeatureEntitlement } from '@german-job-engine/shared-types';

/** Human labels for the 14 real `FeatureEntitlement` values — a direct, honest translation of
 * each real enum member (same spirit as `humanizeStatus`, curated by hand here since a bare
 * mechanical humanize of e.g. `CAN_PERSONALIZE_CV` reads poorly). Used everywhere a plan's real
 * entitlement set needs to be shown to a customer (the pricing comparison matrix, the marketing
 * pricing page) — never a second, hand-written feature list that could drift from what the
 * backend actually grants. */
export const FEATURE_ENTITLEMENT_LABEL: Record<FeatureEntitlement, string> = {
  [FeatureEntitlement.CAN_PRODUCTION_EXECUTE]: 'Production execution',
  [FeatureEntitlement.CAN_PERSONALIZE_CV]: 'CV personalization per company',
  [FeatureEntitlement.CAN_PERSONALIZE_MOTIVATION_LETTER]: 'Motivation letter personalization',
  [FeatureEntitlement.CAN_SMART_APPLICATION_MATCHING]: 'Smart application matching',
  [FeatureEntitlement.CAN_SMART_EXECUTION_TIMING]: 'Strategic send timing',
  [FeatureEntitlement.CAN_DELIVERABILITY_PROTECTION]: 'Deliverability protection',
  [FeatureEntitlement.CAN_DUPLICATE_PREVENTION]: 'Duplicate prevention',
  [FeatureEntitlement.CAN_EXECUTION_TRACKING]: 'Execution tracking',
  [FeatureEntitlement.CAN_ADVANCED_ANALYTICS]: 'Advanced analytics',
  [FeatureEntitlement.CAN_DECISION_INTELLIGENCE]: 'Decision Intelligence',
  [FeatureEntitlement.CAN_MULTI_SPECIALIZATION]: 'Multiple specializations',
  [FeatureEntitlement.CAN_MULTI_USER]: 'Team collaboration',
  [FeatureEntitlement.CAN_EXPORT_REPORTS]: 'Report exports',
  [FeatureEntitlement.CAN_PRIORITY_SUPPORT]: 'Priority support',
};

/** Row order for the comparison matrix — roughly the order a candidate would care about them in,
 * not enum declaration order. */
export const FEATURE_ENTITLEMENT_DISPLAY_ORDER: FeatureEntitlement[] = [
  FeatureEntitlement.CAN_PRODUCTION_EXECUTE,
  FeatureEntitlement.CAN_PERSONALIZE_CV,
  FeatureEntitlement.CAN_PERSONALIZE_MOTIVATION_LETTER,
  FeatureEntitlement.CAN_SMART_APPLICATION_MATCHING,
  FeatureEntitlement.CAN_SMART_EXECUTION_TIMING,
  FeatureEntitlement.CAN_DUPLICATE_PREVENTION,
  FeatureEntitlement.CAN_DELIVERABILITY_PROTECTION,
  FeatureEntitlement.CAN_EXECUTION_TRACKING,
  FeatureEntitlement.CAN_DECISION_INTELLIGENCE,
  FeatureEntitlement.CAN_ADVANCED_ANALYTICS,
  FeatureEntitlement.CAN_MULTI_SPECIALIZATION,
  FeatureEntitlement.CAN_MULTI_USER,
  FeatureEntitlement.CAN_EXPORT_REPORTS,
  FeatureEntitlement.CAN_PRIORITY_SUPPORT,
];
