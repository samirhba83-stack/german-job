import { CampaignStrategyType } from '@german-job-engine/shared-types';

export const SCHEDULER_CONFIG = Symbol('SCHEDULER_CONFIG');

export interface DeadlineUrgencyTier {
  /** This tier applies when hours-remaining-until-deadline is <= this value. */
  readonly withinHours: number;
  readonly weight: number;
}

export interface PriorityConfig {
  readonly strategyWeights: Readonly<Record<CampaignStrategyType, number>>;
  /** Checked in order; the first tier whose `withinHours` the deadline falls within wins. */
  readonly deadlineUrgencyTiers: ReadonlyArray<DeadlineUrgencyTier>;
  readonly overdueWeight: number;
  readonly noUrgencyWeight: number;
}

/** Business-tunable thresholds and weights for the Scheduler. Provided via DI (SCHEDULER_CONFIG)
 * so a future milestone can source these from persisted config instead of code. */
export interface SchedulerConfig {
  readonly priority: PriorityConfig;
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  priority: {
    strategyWeights: {
      [CampaignStrategyType.AGGRESSIVE]: 5,
      [CampaignStrategyType.OUTCOME_OPTIMIZED]: 4,
      [CampaignStrategyType.AI_OPTIMIZED]: 4,
      [CampaignStrategyType.BALANCED]: 3,
      [CampaignStrategyType.CUSTOM]: 2,
      [CampaignStrategyType.CONSERVATIVE]: 1,
    },
    deadlineUrgencyTiers: [
      { withinHours: 24, weight: 8 },
      { withinHours: 72, weight: 5 },
      { withinHours: 168, weight: 2 },
    ],
    overdueWeight: 10,
    noUrgencyWeight: 0,
  },
};
