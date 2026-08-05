import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectedMailboxRepository, CONNECTED_MAILBOX_REPOSITORY } from '../../domain/ports/connected-mailbox.repository';
import { ConnectedMailboxSendAttemptRepository, CONNECTED_MAILBOX_SEND_ATTEMPT_REPOSITORY } from '../../domain/ports/connected-mailbox-send-attempt.repository';
import { ConnectedMailboxRecord } from '../../domain/models/connected-mailbox';
import { checkRateLimits, RateLimitCheckResult, RateLimitPolicyConfig } from '../../domain/services/connected-mailbox-rate-policy';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const RECENT_ATTEMPT_SAMPLE_SIZE = 20;

/**
 * M28.6 Phase 13 — the stateful half of rate limiting: reads real counters/timestamps off
 * `ConnectedMailbox`, decides whether a window has elapsed (a value derived from wall-clock time,
 * not persisted as a boolean), and delegates the actual allow/block decision to the pure
 * `checkRateLimits()` policy function (fully unit-testable in isolation from the database).
 *
 * Known, named limitation: window-reset-then-increment is a read-then-write, not a single atomic
 * SQL statement — a real (narrow) race exists if the exact same mailbox attempts two sends
 * genuinely simultaneously. Judged an acceptable, honestly-documented residual risk rather than
 * over-engineered: `minSendIntervalMs` (20s default) already makes two legitimate sends from the
 * same real send path land at least that far apart in practice, and this is a safety/reputation
 * control, not a financial or security invariant like M28.5's document-version uniqueness.
 */
@Injectable()
export class ConnectedMailboxRateLimiterService {
  constructor(
    @Inject(CONNECTED_MAILBOX_REPOSITORY) private readonly mailboxes: ConnectedMailboxRepository,
    @Inject(CONNECTED_MAILBOX_SEND_ATTEMPT_REPOSITORY) private readonly sendAttempts: ConnectedMailboxSendAttemptRepository,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly config: ConfigService,
  ) {}

  async check(mailbox: ConnectedMailboxRecord): Promise<RateLimitCheckResult> {
    const now = this.clock.now();

    const dailyWindowElapsed = !mailbox.dailySendCountResetAt || now.getTime() - mailbox.dailySendCountResetAt.getTime() >= DAY_MS;
    const hourlyWindowElapsed = !mailbox.rollingWindowStartedAt || now.getTime() - mailbox.rollingWindowStartedAt.getTime() >= HOUR_MS;
    const msSinceLastSend = mailbox.lastSuccessfulSendAt ? now.getTime() - mailbox.lastSuccessfulSendAt.getTime() : null;
    const mailboxAgeDays = mailbox.connectedAt ? (now.getTime() - mailbox.connectedAt.getTime()) / DAY_MS : 0;

    const recentAttempts = await this.sendAttempts.listByConnectedMailboxId(mailbox.id, RECENT_ATTEMPT_SAMPLE_SIZE, 0);
    const settledAttempts = recentAttempts.filter((a) => a.status === 'SENT' || a.status === 'FAILED');
    const recentFailureCount = settledAttempts.filter((a) => a.status === 'FAILED').length;

    return checkRateLimits(
      {
        dailySendCountInWindow: dailyWindowElapsed ? 0 : mailbox.dailySendCount,
        hourlySendCountInWindow: hourlyWindowElapsed ? 0 : mailbox.rollingSendCount,
        msSinceLastSend,
        mailboxAgeDays,
        recentAttemptCount: settledAttempts.length,
        recentFailureCount,
      },
      this.policyConfig(),
    );
  }

  /** Called once per real send attempt (success or failure both count toward the rate — a
   * failed send still consumed a real provider API call and real risk). */
  async recordAttempt(mailboxId: string): Promise<void> {
    const now = this.clock.now();
    const mailbox = await this.mailboxes.findById(mailboxId);
    if (!mailbox) return;

    const dailyWindowElapsed = !mailbox.dailySendCountResetAt || now.getTime() - mailbox.dailySendCountResetAt.getTime() >= DAY_MS;
    const hourlyWindowElapsed = !mailbox.rollingWindowStartedAt || now.getTime() - mailbox.rollingWindowStartedAt.getTime() >= HOUR_MS;

    await this.mailboxes.update(
      mailboxId,
      {
        dailySendCount: dailyWindowElapsed ? 1 : mailbox.dailySendCount + 1,
        dailySendCountResetAt: dailyWindowElapsed ? now : (mailbox.dailySendCountResetAt ?? now),
        rollingSendCount: hourlyWindowElapsed ? 1 : mailbox.rollingSendCount + 1,
        rollingWindowStartedAt: hourlyWindowElapsed ? now : (mailbox.rollingWindowStartedAt ?? now),
      },
      now,
    );
  }

  private policyConfig(): RateLimitPolicyConfig {
    return {
      dailySendLimit: this.config.get<number>('connectedMailbox.rateLimits.dailySendLimit', 30),
      hourlySendLimit: this.config.get<number>('connectedMailbox.rateLimits.hourlySendLimit', 10),
      minSendIntervalMs: this.config.get<number>('connectedMailbox.rateLimits.minSendIntervalMs', 20_000),
      warmupDays: this.config.get<number>('connectedMailbox.rateLimits.warmupDays', 7),
      warmupDailySendLimit: this.config.get<number>('connectedMailbox.rateLimits.warmupDailySendLimit', 5),
      failureRateThreshold: this.config.get<number>('connectedMailbox.rateLimits.failureRateThreshold', 0.3),
      failureRateMinSamples: this.config.get<number>('connectedMailbox.rateLimits.failureRateMinSamples', 5),
    };
  }
}
