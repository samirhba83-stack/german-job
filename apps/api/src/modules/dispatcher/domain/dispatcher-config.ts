import { Weekday } from '@german-job-engine/shared-types';

export const DISPATCHER_CONFIG = Symbol('DISPATCHER_CONFIG');

export interface InboxProtectionConfig {
  /** Composite risk score at or above this threshold is treated as spam-risk-too-high. */
  readonly highRiskThreshold: number;
  /** How heavily daily-quota usage counts toward the composite risk score. */
  readonly dailyUtilizationWeight: number;
  /** How heavily the recent (24h) dispatch failure rate counts toward the composite risk score. */
  readonly failureRateWeight: number;
}

export interface AdaptiveBatchSizeConfig {
  /** Below this campaign health score, batch-size escalation is paused. */
  readonly healthGoodThreshold: number;
}

export interface IntelligentTimingConfig {
  readonly businessStartHour: number;
  readonly businessEndHour: number;
  readonly businessWeekdays: ReadonlyArray<Weekday>;
}

export interface DeliveryConfidenceConfig {
  /** Weight given to the campaign's own health assessment, when one exists. */
  readonly healthWeight: number;
  /** Weight given to the inverse of the current risk score. */
  readonly riskInverseWeight: number;
}

export interface PacingConfig {
  /** Base recommended pause after a batch completes, before scaling by the current risk score. */
  readonly baseCooldownMs: number;
  /** Fixed re-evaluation delay when Inbox Protection denies execution outright. */
  readonly riskReevaluationDelayMs: number;
}

/** Business-tunable thresholds and weights for the Dispatcher. Provided via DI
 * (DISPATCHER_CONFIG) so a future milestone can source these from persisted config instead of
 * code, and so every threshold in this milestone's "no magic numbers" requirement has exactly
 * one place it's defined. */
export interface DispatcherConfig {
  readonly inboxProtection: InboxProtectionConfig;
  readonly adaptiveBatchSize: AdaptiveBatchSizeConfig;
  readonly intelligentTiming: IntelligentTimingConfig;
  readonly deliveryConfidence: DeliveryConfidenceConfig;
  readonly pacing: PacingConfig;
}

const HOUR_MS = 60 * 60 * 1000;

export const DEFAULT_DISPATCHER_CONFIG: DispatcherConfig = {
  inboxProtection: {
    highRiskThreshold: 0.75,
    dailyUtilizationWeight: 0.6,
    failureRateWeight: 0.4,
  },
  adaptiveBatchSize: {
    healthGoodThreshold: 0.5,
  },
  intelligentTiming: {
    businessStartHour: 8,
    businessEndHour: 18,
    businessWeekdays: [Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY, Weekday.FRIDAY],
  },
  deliveryConfidence: {
    healthWeight: 0.5,
    riskInverseWeight: 0.5,
  },
  pacing: {
    baseCooldownMs: 30 * 60 * 1000,
    riskReevaluationDelayMs: HOUR_MS,
  },
};
