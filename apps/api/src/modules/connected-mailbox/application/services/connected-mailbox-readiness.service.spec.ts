import { ConfigService } from '@nestjs/config';
import { ConnectedMailboxReadinessService } from './connected-mailbox-readiness.service';
import { ConnectedMailboxRepository } from '../../domain/ports/connected-mailbox.repository';
import { ConnectedMailboxRecord } from '../../domain/models/connected-mailbox';
import { ConnectedMailboxRateLimiterService } from './connected-mailbox-rate-limiter.service';
import { DeliverabilityService } from '../../../deliverability/application/services/deliverability.service';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';

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
    grantedScopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email', 'openid'],
    tokenEncryptionVersion: 1,
    encryptedRefreshToken: 'iv:tag:ct',
    encryptedAccessToken: 'iv:tag:ct',
    accessTokenExpiresAt: null,
    hasRefreshToken: true,
    connectedAt: NOW,
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

const READY_CONFIG = { 'connectedMailbox.productionSendingEnabled': true, 'productionSafety.realCompanyOutreachEnabled': true };

function harness(configOverrides: Record<string, unknown> = READY_CONFIG) {
  const mailboxes: jest.Mocked<ConnectedMailboxRepository> = {
    findById: jest.fn(),
    findActiveByUserId: jest.fn().mockResolvedValue(mailbox()),
    findByProviderAccount: jest.fn(),
    findByProviderAndEmailAddress: jest.fn(),
    listByUserId: jest.fn(),
    listAll: jest.fn(),
    createConnected: jest.fn(),
    update: jest.fn(),
  };
  const rateLimiter = { check: jest.fn().mockResolvedValue({ allowed: true, reason: null, detail: null }) } as unknown as jest.Mocked<ConnectedMailboxRateLimiterService>;
  const deliverability = { isSuppressed: jest.fn().mockResolvedValue(false) } as unknown as jest.Mocked<DeliverabilityService>;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<EmailSecurityAuditService>;
  const config = { get: jest.fn((key: string, defaultValue?: unknown) => configOverrides[key] ?? defaultValue) } as unknown as ConfigService;

  const service = new ConnectedMailboxReadinessService(mailboxes, rateLimiter, deliverability, audit, config);
  return { service, mailboxes, rateLimiter, deliverability, audit };
}

describe('ConnectedMailboxReadinessService', () => {
  it('is ready when every real condition passes', async () => {
    const { service } = harness();
    const result = await service.checkReadiness({ userId: 'user-1', recipientEmailAddress: 'r@example.de' });
    expect(result.ready).toBe(true);
    expect(result.blockingReasons).toHaveLength(0);
    expect(result.mailbox).not.toBeNull();
  });

  it('blocks when production sending is not enabled (the default production safety gate)', async () => {
    const { service } = harness({});
    const result = await service.checkReadiness({ userId: 'user-1', recipientEmailAddress: 'r@example.de' });
    expect(result.ready).toBe(false);
    expect(result.blockingReasons.some((r) => r.includes('not enabled'))).toBe(true);
  });

  it('blocks when real company outreach is not enabled and the recipient is not an approved test recipient, even with production sending otherwise on (M31 Phase 26 — the two flags are independent)', async () => {
    const { service } = harness({ 'connectedMailbox.productionSendingEnabled': true });
    const result = await service.checkReadiness({ userId: 'user-1', recipientEmailAddress: 'r@example.de' });
    expect(result.ready).toBe(false);
    expect(result.blockingReasons.some((r) => r.startsWith('TEST_RECIPIENT_POLICY_BLOCKED'))).toBe(true);
  });

  it('M31.1 Phase 17 — allows a send to an approved test-recipient allowlist entry even while real company outreach is disabled', async () => {
    const { service } = harness({
      'connectedMailbox.productionSendingEnabled': true,
      'productionSafety.realCompanyOutreachEnabled': false,
      'productionSafety.testRecipientAllowlist': ['approved-tester@example.com'],
    });
    const result = await service.checkReadiness({ userId: 'user-1', recipientEmailAddress: 'Approved-Tester@Example.com' });
    expect(result.ready).toBe(true);
  });

  it('M31.1 Phase 17 — allows a send to a recipient matching an approved @domain wildcard entry', async () => {
    const { service } = harness({
      'connectedMailbox.productionSendingEnabled': true,
      'productionSafety.realCompanyOutreachEnabled': false,
      'productionSafety.testRecipientAllowlist': ['@approved-test-domain.example'],
    });
    const result = await service.checkReadiness({ userId: 'user-1', recipientEmailAddress: 'anyone@approved-test-domain.example' });
    expect(result.ready).toBe(true);
  });

  it('M31.1 Phase 17 — an empty allowlist approves nobody (fails closed, never falls back to "allow everyone")', async () => {
    const { service } = harness({
      'connectedMailbox.productionSendingEnabled': true,
      'productionSafety.realCompanyOutreachEnabled': false,
      'productionSafety.testRecipientAllowlist': [],
    });
    const result = await service.checkReadiness({ userId: 'user-1', recipientEmailAddress: 'anyone@example.com' });
    expect(result.ready).toBe(false);
  });

  it('blocks when the recipient is on the suppression list', async () => {
    const { service, deliverability } = harness();
    deliverability.isSuppressed.mockResolvedValue(true);
    const result = await service.checkReadiness({ userId: 'user-1', recipientEmailAddress: 'suppressed@example.de' });
    expect(result.ready).toBe(false);
    expect(result.blockingReasons.some((r) => r.includes('suppression'))).toBe(true);
  });

  it('blocks with no mailbox when the user has never connected one', async () => {
    const { service, mailboxes } = harness();
    mailboxes.findActiveByUserId.mockResolvedValue(null);
    const result = await service.checkReadiness({ userId: 'user-1', recipientEmailAddress: 'r@example.de' });
    expect(result.ready).toBe(false);
    expect(result.mailbox).toBeNull();
    expect(result.blockingReasons.some((r) => r.includes('No connected mailbox'))).toBe(true);
  });

  it('blocks a mailbox that is not in CONNECTED status', async () => {
    const { service, mailboxes } = harness();
    mailboxes.findActiveByUserId.mockResolvedValue(mailbox({ status: 'REAUTHORIZATION_REQUIRED' }));
    const result = await service.checkReadiness({ userId: 'user-1', recipientEmailAddress: 'r@example.de' });
    expect(result.ready).toBe(false);
  });

  it('blocks a user-disabled mailbox', async () => {
    const { service, mailboxes } = harness();
    mailboxes.findActiveByUserId.mockResolvedValue(mailbox({ userDisabled: true }));
    const result = await service.checkReadiness({ userId: 'user-1', recipientEmailAddress: 'r@example.de' });
    expect(result.ready).toBe(false);
  });

  it('blocks a system-suspended mailbox', async () => {
    const { service, mailboxes } = harness();
    mailboxes.findActiveByUserId.mockResolvedValue(mailbox({ systemSuspended: true, suspensionReason: 'safety review' }));
    const result = await service.checkReadiness({ userId: 'user-1', recipientEmailAddress: 'r@example.de' });
    expect(result.ready).toBe(false);
    expect(result.blockingReasons.some((r) => r.includes('safety review'))).toBe(true);
  });

  it('blocks a mailbox needing reauthorization', async () => {
    const { service, mailboxes } = harness();
    mailboxes.findActiveByUserId.mockResolvedValue(mailbox({ reauthorizationRequired: true }));
    const result = await service.checkReadiness({ userId: 'user-1', recipientEmailAddress: 'r@example.de' });
    expect(result.ready).toBe(false);
  });

  it('blocks a mailbox with no valid refresh token on file', async () => {
    const { service, mailboxes } = harness();
    mailboxes.findActiveByUserId.mockResolvedValue(mailbox({ hasRefreshToken: false }));
    const result = await service.checkReadiness({ userId: 'user-1', recipientEmailAddress: 'r@example.de' });
    expect(result.ready).toBe(false);
  });

  it('blocks a mailbox with a scope grant that no longer passes policy (e.g. missing a required scope after a partial revoke)', async () => {
    const { service, mailboxes } = harness();
    mailboxes.findActiveByUserId.mockResolvedValue(mailbox({ grantedScopes: ['openid'] }));
    const result = await service.checkReadiness({ userId: 'user-1', recipientEmailAddress: 'r@example.de' });
    expect(result.ready).toBe(false);
  });

  it('blocks when the rate limiter denies the send, surfacing its own detail message', async () => {
    const { service, rateLimiter } = harness();
    rateLimiter.check.mockResolvedValue({ allowed: false, reason: 'DAILY_LIMIT_EXCEEDED', detail: 'Daily send limit of 30 reached for this mailbox.' });
    const result = await service.checkReadiness({ userId: 'user-1', recipientEmailAddress: 'r@example.de' });
    expect(result.ready).toBe(false);
    expect(result.blockingReasons).toContain('Daily send limit of 30 reached for this mailbox.');
  });

  it('does not call the rate limiter at all once a mailbox-state check has already failed (short-circuits before the extra work)', async () => {
    const { service, mailboxes, rateLimiter } = harness();
    mailboxes.findActiveByUserId.mockResolvedValue(mailbox({ status: 'REVOKED' }));
    await service.checkReadiness({ userId: 'user-1', recipientEmailAddress: 'r@example.de' });
    expect(rateLimiter.check).not.toHaveBeenCalled();
  });

  it('accumulates every blocking reason rather than stopping at the first', async () => {
    const { service, mailboxes, deliverability } = harness({});
    deliverability.isSuppressed.mockResolvedValue(true);
    mailboxes.findActiveByUserId.mockResolvedValue(mailbox({ systemSuspended: true, reauthorizationRequired: true }));

    const result = await service.checkReadiness({ userId: 'user-1', recipientEmailAddress: 'r@example.de' });
    expect(result.blockingReasons.length).toBeGreaterThanOrEqual(4);
  });

  it('records CONNECTED_SEND_RESERVED on a ready outcome and CONNECTED_SEND_BLOCKED otherwise', async () => {
    const { service, audit } = harness();
    await service.checkReadiness({ userId: 'user-1', recipientEmailAddress: 'r@example.de' });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'CONNECTED_SEND_RESERVED' }));

    const { service: blockedService, audit: blockedAudit } = harness({});
    await blockedService.checkReadiness({ userId: 'user-1', recipientEmailAddress: 'r@example.de' });
    expect(blockedAudit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'CONNECTED_SEND_BLOCKED' }));
  });
});
