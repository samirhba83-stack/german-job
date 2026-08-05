/**
 * M28.6 Phase 13 — pure, stateless rate/reputation-safety policy. A connected personal mailbox is
 * never treated like bulk-email infrastructure merely because the provider technically permits a
 * higher volume. All numeric inputs are already-computed "current window" values — deciding
 * whether a window has elapsed and should reset is a stateful concern the calling service owns
 * (`ConnectedMailboxRateLimiterService`); this function only answers "given these real numbers,
 * is one more send allowed right now."
 */
export interface RateLimitPolicyConfig {
  readonly dailySendLimit: number;
  readonly hourlySendLimit: number;
  readonly minSendIntervalMs: number;
  readonly warmupDays: number;
  readonly warmupDailySendLimit: number;
  readonly failureRateThreshold: number;
  readonly failureRateMinSamples: number;
}

export interface RateLimitCheckInput {
  readonly dailySendCountInWindow: number;
  readonly hourlySendCountInWindow: number;
  readonly msSinceLastSend: number | null;
  readonly mailboxAgeDays: number;
  readonly recentAttemptCount: number;
  readonly recentFailureCount: number;
}

export type RateLimitBlockReason = 'MIN_INTERVAL_NOT_ELAPSED' | 'HOURLY_LIMIT_EXCEEDED' | 'DAILY_LIMIT_EXCEEDED' | 'WARMUP_LIMIT_EXCEEDED' | 'FAILURE_RATE_EXCEEDED';

export interface RateLimitCheckResult {
  readonly allowed: boolean;
  readonly reason: RateLimitBlockReason | null;
  readonly detail: string | null;
}

export function checkRateLimits(input: RateLimitCheckInput, config: RateLimitPolicyConfig): RateLimitCheckResult {
  if (input.msSinceLastSend !== null && input.msSinceLastSend < config.minSendIntervalMs) {
    return {
      allowed: false,
      reason: 'MIN_INTERVAL_NOT_ELAPSED',
      detail: `Must wait at least ${config.minSendIntervalMs}ms between sends from the same mailbox (${input.msSinceLastSend}ms elapsed).`,
    };
  }

  if (input.hourlySendCountInWindow >= config.hourlySendLimit) {
    return { allowed: false, reason: 'HOURLY_LIMIT_EXCEEDED', detail: `Hourly send limit of ${config.hourlySendLimit} reached for this mailbox.` };
  }

  const inWarmup = input.mailboxAgeDays < config.warmupDays;
  const effectiveDailyLimit = inWarmup ? config.warmupDailySendLimit : config.dailySendLimit;
  if (input.dailySendCountInWindow >= effectiveDailyLimit) {
    return {
      allowed: false,
      reason: inWarmup ? 'WARMUP_LIMIT_EXCEEDED' : 'DAILY_LIMIT_EXCEEDED',
      detail: inWarmup
        ? `This mailbox is still in its ${config.warmupDays}-day warm-up period (day ${Math.floor(input.mailboxAgeDays) + 1}) — daily limit is ${effectiveDailyLimit}.`
        : `Daily send limit of ${effectiveDailyLimit} reached for this mailbox.`,
    };
  }

  if (input.recentAttemptCount >= config.failureRateMinSamples) {
    const failureRate = input.recentFailureCount / input.recentAttemptCount;
    if (failureRate > config.failureRateThreshold) {
      return {
        allowed: false,
        reason: 'FAILURE_RATE_EXCEEDED',
        detail: `Recent failure rate (${(failureRate * 100).toFixed(0)}%) exceeds the ${(config.failureRateThreshold * 100).toFixed(0)}% safety threshold — sending paused for review.`,
      };
    }
  }

  return { allowed: true, reason: null, detail: null };
}
