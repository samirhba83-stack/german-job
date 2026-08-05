import { checkRateLimits, RateLimitPolicyConfig, RateLimitCheckInput } from './connected-mailbox-rate-policy';

const CONFIG: RateLimitPolicyConfig = {
  dailySendLimit: 30,
  hourlySendLimit: 10,
  minSendIntervalMs: 20_000,
  warmupDays: 7,
  warmupDailySendLimit: 5,
  failureRateThreshold: 0.3,
  failureRateMinSamples: 5,
};

const BASE_INPUT: RateLimitCheckInput = {
  dailySendCountInWindow: 0,
  hourlySendCountInWindow: 0,
  msSinceLastSend: null,
  mailboxAgeDays: 30,
  recentAttemptCount: 0,
  recentFailureCount: 0,
};

describe('checkRateLimits', () => {
  it('allows a first-ever send with no prior activity', () => {
    expect(checkRateLimits(BASE_INPUT, CONFIG)).toEqual({ allowed: true, reason: null, detail: null });
  });

  it('blocks a send that arrives before the minimum interval has elapsed', () => {
    const result = checkRateLimits({ ...BASE_INPUT, msSinceLastSend: 5_000 }, CONFIG);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('MIN_INTERVAL_NOT_ELAPSED');
  });

  it('allows a send exactly at the minimum interval boundary (not blocked when equal)', () => {
    const result = checkRateLimits({ ...BASE_INPUT, msSinceLastSend: 20_000 }, CONFIG);
    expect(result.allowed).toBe(true);
  });

  it('blocks once the hourly limit is reached', () => {
    const result = checkRateLimits({ ...BASE_INPUT, hourlySendCountInWindow: 10 }, CONFIG);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('HOURLY_LIMIT_EXCEEDED');
  });

  it('blocks once the daily limit is reached for a mature (post-warmup) mailbox', () => {
    const result = checkRateLimits({ ...BASE_INPUT, dailySendCountInWindow: 30, mailboxAgeDays: 30 }, CONFIG);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('DAILY_LIMIT_EXCEEDED');
  });

  it('applies the stricter warm-up daily limit for a newly-connected mailbox', () => {
    const result = checkRateLimits({ ...BASE_INPUT, dailySendCountInWindow: 5, mailboxAgeDays: 2 }, CONFIG);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('WARMUP_LIMIT_EXCEEDED');
  });

  it('allows up to the mature daily limit once warm-up has elapsed, even if that count would have blocked during warm-up', () => {
    const result = checkRateLimits({ ...BASE_INPUT, dailySendCountInWindow: 6, mailboxAgeDays: 8 }, CONFIG);
    expect(result.allowed).toBe(true);
  });

  it('blocks when the recent failure rate exceeds the safety threshold, once enough samples exist', () => {
    const result = checkRateLimits({ ...BASE_INPUT, recentAttemptCount: 5, recentFailureCount: 2 }, CONFIG);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('FAILURE_RATE_EXCEEDED');
  });

  it('does not evaluate failure rate below the minimum sample size, even with a 100% failure rate', () => {
    const result = checkRateLimits({ ...BASE_INPUT, recentAttemptCount: 2, recentFailureCount: 2 }, CONFIG);
    expect(result.allowed).toBe(true);
  });

  it('allows a failure rate at or below the threshold once the minimum sample size is met', () => {
    const result = checkRateLimits({ ...BASE_INPUT, recentAttemptCount: 10, recentFailureCount: 3 }, CONFIG);
    expect(result.allowed).toBe(true);
  });

  it('checks min-interval before hourly/daily/failure-rate (first blocking reason wins, in priority order)', () => {
    const result = checkRateLimits(
      { ...BASE_INPUT, msSinceLastSend: 1_000, hourlySendCountInWindow: 999, dailySendCountInWindow: 999, recentAttemptCount: 999, recentFailureCount: 999 },
      CONFIG,
    );
    expect(result.reason).toBe('MIN_INTERVAL_NOT_ELAPSED');
  });
});
