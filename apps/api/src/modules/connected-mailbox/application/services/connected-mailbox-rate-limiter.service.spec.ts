import { ConfigService } from '@nestjs/config';
import { ConnectedMailboxRateLimiterService } from './connected-mailbox-rate-limiter.service';
import { ConnectedMailboxRepository } from '../../domain/ports/connected-mailbox.repository';
import { ConnectedMailboxSendAttemptRepository } from '../../domain/ports/connected-mailbox-send-attempt.repository';
import { ConnectedMailboxRecord } from '../../domain/models/connected-mailbox';
import { ConnectedMailboxSendAttemptRecord } from '../../domain/models/connected-mailbox-send-attempt';
import { ExecutionClock } from '../../../execution/domain/ports/execution-clock.port';

const NOW = new Date('2026-08-01T12:00:00.000Z');

function mailbox(overrides: Partial<ConnectedMailboxRecord> = {}): ConnectedMailboxRecord {
  return {
    id: 'mailbox-1',
    userId: 'user-1',
    provider: 'GOOGLE_GMAIL',
    providerAccountId: 'acct-1',
    emailAddress: 'jane@gmail.com',
    displayName: null,
    isActive: true,
    status: 'CONNECTED',
    grantedScopes: [],
    tokenEncryptionVersion: 1,
    encryptedRefreshToken: 'iv:tag:ct',
    encryptedAccessToken: 'iv:tag:ct',
    accessTokenExpiresAt: null,
    hasRefreshToken: true,
    connectedAt: new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000),
    lastRefreshedAt: null,
    lastSuccessfulSendAt: null,
    lastFailureAt: null,
    failureCategory: null,
    failureReason: null,
    reauthorizationRequired: false,
    userDisabled: false,
    systemSuspended: false,
    suspensionReason: null,
    dailySendCount: 0,
    dailySendCountResetAt: null,
    rollingSendCount: 0,
    rollingWindowStartedAt: null,
    providerDailyLimit: null,
    consentVersion: '1.0',
    consentAcceptedAt: NOW,
    inboxCapabilityStatus: 'NOT_REQUESTED',
    inboxGrantedScopes: [],
    inboxConsentVersion: null,
    inboxConsentAcceptedAt: null,
    inboxRevokedAt: null,
    lastSuccessfulInboxAccessAt: null,
    inboxReauthorizationRequired: false,
    inboxUserDisabled: false,
    inboxSystemSuspended: false,
    inboxSuspensionReason: null,
    inboxFailureCategory: null,
    inboxFailureReason: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function attempt(status: 'SENT' | 'FAILED' | 'PENDING' | 'BLOCKED'): ConnectedMailboxSendAttemptRecord {
  return {
    id: `attempt-${Math.random()}`,
    idempotencyKey: 'k',
    connectedMailboxId: 'mailbox-1',
    verifiedSenderEmail: 'jane@gmail.com',
    provider: 'GOOGLE_GMAIL',
    providerAccountId: 'acct-1',
    applicationId: null,
    campaignId: null,
    recipientEmail: 'r@example.de',
    subject: 's',
    bodyChecksumSha256: 'h',
    attachmentRefs: [],
    status,
    providerMessageId: null,
    providerThreadId: null,
    rfcMessageId: null,
    attempts: 1,
    lastFailureCategory: null,
    lastFailureReason: null,
    correlationId: null,
    traceId: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function harness() {
  const mailboxes: jest.Mocked<ConnectedMailboxRepository> = {
    findById: jest.fn(),
    findActiveByUserId: jest.fn(),
    findByProviderAccount: jest.fn(),
    findByProviderAndEmailAddress: jest.fn(),
    listByUserId: jest.fn(),
    listAll: jest.fn(),
    createConnected: jest.fn(),
    update: jest.fn(),
  };
  const sendAttempts: jest.Mocked<ConnectedMailboxSendAttemptRepository> = {
    reserve: jest.fn(),
    findByIdempotencyKey: jest.fn(),
    findByProviderThreadId: jest.fn(),
    findByRfcMessageId: jest.fn(),
    markOutcome: jest.fn(),
    incrementAttempts: jest.fn(),
    listByConnectedMailboxId: jest.fn().mockResolvedValue([]),
  };
  const clock: ExecutionClock = { now: () => NOW };
  const config = { get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue) } as unknown as ConfigService;

  const service = new ConnectedMailboxRateLimiterService(mailboxes, sendAttempts, clock, config);
  return { service, mailboxes, sendAttempts };
}

describe('ConnectedMailboxRateLimiterService', () => {
  describe('check', () => {
    it('allows a mature mailbox with no prior activity', async () => {
      const { service } = harness();
      const result = await service.check(mailbox());
      expect(result.allowed).toBe(true);
    });

    it('resets the daily count to zero once the 24h window has elapsed, rather than carrying the stale count forward', async () => {
      const { service } = harness();
      const result = await service.check(
        mailbox({ dailySendCount: 999, dailySendCountResetAt: new Date(NOW.getTime() - 25 * 60 * 60 * 1000) }),
      );
      expect(result.allowed).toBe(true);
    });

    it('blocks when the daily count is still within an unexpired window and at the limit', async () => {
      const { service } = harness();
      const result = await service.check(mailbox({ dailySendCount: 30, dailySendCountResetAt: new Date(NOW.getTime() - 60 * 60 * 1000) }));
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('DAILY_LIMIT_EXCEEDED');
    });

    it('resets the hourly rolling count once the 1h window has elapsed', async () => {
      const { service } = harness();
      const result = await service.check(mailbox({ rollingSendCount: 999, rollingWindowStartedAt: new Date(NOW.getTime() - 90 * 60 * 1000) }));
      expect(result.allowed).toBe(true);
    });

    it('blocks a mailbox still inside its warm-up period once its stricter daily limit is reached', async () => {
      const { service } = harness();
      const result = await service.check(
        mailbox({ connectedAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000), dailySendCount: 5, dailySendCountResetAt: new Date(NOW.getTime() - 60 * 60 * 1000) }),
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('WARMUP_LIMIT_EXCEEDED');
    });

    it('derives msSinceLastSend from the real lastSuccessfulSendAt timestamp and blocks inside the min interval', async () => {
      const { service } = harness();
      const result = await service.check(mailbox({ lastSuccessfulSendAt: new Date(NOW.getTime() - 5_000) }));
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('MIN_INTERVAL_NOT_ELAPSED');
    });

    it('counts only settled (SENT/FAILED) attempts toward the failure-rate sample, excluding PENDING/BLOCKED', async () => {
      const { service, sendAttempts } = harness();
      sendAttempts.listByConnectedMailboxId.mockResolvedValue([
        attempt('FAILED'), attempt('FAILED'), attempt('FAILED'),
        attempt('SENT'), attempt('SENT'),
        attempt('PENDING'), attempt('BLOCKED'),
      ]);
      const result = await service.check(mailbox());
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('FAILURE_RATE_EXCEEDED');
    });
  });

  describe('recordAttempt', () => {
    it('increments both counters and preserves existing window-start timestamps mid-window', async () => {
      const { service, mailboxes } = harness();
      const windowStart = new Date(NOW.getTime() - 10 * 60 * 1000);
      mailboxes.findById.mockResolvedValue(mailbox({ dailySendCount: 2, dailySendCountResetAt: windowStart, rollingSendCount: 1, rollingWindowStartedAt: windowStart }));

      await service.recordAttempt('mailbox-1');

      expect(mailboxes.update).toHaveBeenCalledWith(
        'mailbox-1',
        { dailySendCount: 3, dailySendCountResetAt: windowStart, rollingSendCount: 2, rollingWindowStartedAt: windowStart },
        NOW,
      );
    });

    it('resets both counters to 1 with a fresh window start once their windows have elapsed', async () => {
      const { service, mailboxes } = harness();
      mailboxes.findById.mockResolvedValue(
        mailbox({ dailySendCount: 29, dailySendCountResetAt: new Date(NOW.getTime() - 25 * 60 * 60 * 1000), rollingSendCount: 9, rollingWindowStartedAt: new Date(NOW.getTime() - 90 * 60 * 1000) }),
      );

      await service.recordAttempt('mailbox-1');

      expect(mailboxes.update).toHaveBeenCalledWith('mailbox-1', { dailySendCount: 1, dailySendCountResetAt: NOW, rollingSendCount: 1, rollingWindowStartedAt: NOW }, NOW);
    });

    it('is a safe no-op when the mailbox no longer exists', async () => {
      const { service, mailboxes } = harness();
      mailboxes.findById.mockResolvedValue(null);
      await expect(service.recordAttempt('gone')).resolves.toBeUndefined();
      expect(mailboxes.update).not.toHaveBeenCalled();
    });
  });
});
