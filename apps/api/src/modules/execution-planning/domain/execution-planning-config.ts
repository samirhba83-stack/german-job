export const EXECUTION_PLANNING_CONFIG = Symbol('EXECUTION_PLANNING_CONFIG');

/** Business-tunable thresholds, durations, and multipliers for the Execution Planning Engine.
 * Provided via DI (EXECUTION_PLANNING_CONFIG) so every number that shapes a plan — how many
 * batches, how long to cool down, how aggressively to retry — is configuration, never a
 * hardcoded constant inside the planning algorithm. */
export interface ExecutionPlanningConfig {
  /** Number of execution batches for a plan under normal (non-low) confidence. */
  readonly baseBatchCount: number;
  /** Below this confidence score, extra batches are added for finer-grained health checkpoints. */
  readonly lowConfidenceThreshold: number;
  readonly lowConfidenceExtraBatches: number;
  readonly interBatchDelayMs: number;
  readonly interStepDelayMs: number;
  readonly cooldownDurationMs: number;
  /** Multiplies cooldownDurationMs when the final recommendation's category is RISK. */
  readonly cooldownRiskMultiplier: number;
  readonly maxRetryAttempts: number;
  readonly retryBackoffBaseMs: number;
  /** Geometric growth factor applied to each successive retry's backoff delay. */
  readonly retryBackoffMultiplier: number;
  /** Duration of each abstract execution window. */
  readonly windowDurationMs: number;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export const DEFAULT_EXECUTION_PLANNING_CONFIG: ExecutionPlanningConfig = {
  baseBatchCount: 3,
  lowConfidenceThreshold: 0.6,
  lowConfidenceExtraBatches: 2,
  interBatchDelayMs: 30 * MINUTE_MS,
  interStepDelayMs: 5 * MINUTE_MS,
  cooldownDurationMs: HOUR_MS,
  cooldownRiskMultiplier: 2,
  maxRetryAttempts: 3,
  retryBackoffBaseMs: 15 * MINUTE_MS,
  retryBackoffMultiplier: 2,
  windowDurationMs: 4 * HOUR_MS,
};
