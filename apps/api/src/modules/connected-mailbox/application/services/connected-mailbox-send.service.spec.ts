import { ConnectedMailboxSendService, SendCandidateApplicationParams } from './connected-mailbox-send.service';
import { ConnectedMailboxRepository } from '../../domain/ports/connected-mailbox.repository';
import { ConnectedMailboxSendAttemptRepository } from '../../domain/ports/connected-mailbox-send-attempt.repository';
import { ConnectedMailboxProviderPort } from '../../domain/ports/connected-mailbox-provider.port';
import { ConnectedMailboxRecord } from '../../domain/models/connected-mailbox';
import { ConnectedMailboxSendAttemptRecord } from '../../domain/models/connected-mailbox-send-attempt';
import { AttachmentResolverPort } from '../../../documents/domain/ports/attachment-resolver.port';
import { ExecutionClock } from '../../../execution/domain/ports/execution-clock.port';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { ConnectedMailboxReadinessService } from './connected-mailbox-readiness.service';
import { ConnectedMailboxRateLimiterService } from './connected-mailbox-rate-limiter.service';
import { MailboxTokenVaultService } from './mailbox-token-vault.service';

const NOW = new Date('2026-08-01T12:00:00.000Z');

function mailbox(overrides: Partial<ConnectedMailboxRecord> = {}): ConnectedMailboxRecord {
  return {
    id: 'mailbox-1',
    userId: 'user-1',
    provider: 'GOOGLE_GMAIL',
    providerAccountId: 'acct-1',
    emailAddress: 'jane@gmail.com',
    displayName: 'Jane Candidate',
    isActive: true,
    status: 'CONNECTED',
    grantedScopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email', 'openid'],
    tokenEncryptionVersion: 1,
    encryptedRefreshToken: 'iv:tag:ct',
    encryptedAccessToken: 'iv:tag:ct',
    accessTokenExpiresAt: new Date(NOW.getTime() + 3600_000),
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

function sendAttempt(overrides: Partial<ConnectedMailboxSendAttemptRecord> = {}): ConnectedMailboxSendAttemptRecord {
  return {
    id: 'attempt-1',
    idempotencyKey: 'connected-mailbox:app-1',
    connectedMailboxId: 'mailbox-1',
    verifiedSenderEmail: 'jane@gmail.com',
    provider: 'GOOGLE_GMAIL',
    providerAccountId: 'acct-1',
    applicationId: 'app-1',
    campaignId: 'campaign-1',
    recipientEmail: 'recruiter@example.de',
    subject: 'Application',
    bodyChecksumSha256: 'checksum',
    attachmentRefs: [],
    status: 'PENDING',
    providerMessageId: null,
    providerThreadId: null,
    rfcMessageId: null,
    attempts: 0,
    lastFailureCategory: null,
    lastFailureReason: null,
    correlationId: null,
    traceId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const PARAMS: SendCandidateApplicationParams = {
  requestId: 'app-1',
  userId: 'user-1',
  applicationId: 'app-1',
  campaignId: 'campaign-1',
  recipientEmailAddress: 'recruiter@example.de',
  subject: 'Application',
  plainTextBody: 'Hello',
  htmlBody: null,
  attachments: [],
  correlationId: 'corr-1',
  traceId: 'trace-1',
};

function harness() {
  const mailboxes: jest.Mocked<ConnectedMailboxRepository> = {
    findById: jest.fn(),
    findActiveByUserId: jest.fn(),
    findByProviderAccount: jest.fn(),
    findByProviderAndEmailAddress: jest.fn(),
    listByUserId: jest.fn(),
    listAll: jest.fn(),
    createConnected: jest.fn(),
    update: jest.fn().mockResolvedValue(mailbox()),
  };
  const sendAttempts: jest.Mocked<ConnectedMailboxSendAttemptRepository> = {
    reserve: jest.fn().mockResolvedValue(sendAttempt()),
    findByIdempotencyKey: jest.fn(),
    findByProviderThreadId: jest.fn(),
    findByRfcMessageId: jest.fn(),
    markOutcome: jest.fn().mockResolvedValue(undefined),
    incrementAttempts: jest.fn().mockResolvedValue(undefined),
    listByConnectedMailboxId: jest.fn().mockResolvedValue([]),
  };
  const providerAdapter: jest.Mocked<ConnectedMailboxProviderPort> = {
    provider: 'GOOGLE_GMAIL',
    buildAuthorizationUrl: jest.fn(),
    exchangeAuthorizationCode: jest.fn(),
    refreshAccessToken: jest.fn(),
    revokeAuthorization: jest.fn(),
    getMailboxIdentity: jest.fn(),
    sendMessage: jest.fn().mockResolvedValue({ status: 'ACCEPTED', accepted: true, providerMessageId: 'msg-1', providerThreadId: 'thread-1', providerMessage: 'ok', failure: null }),
    checkHealth: jest.fn(),
  };
  const attachmentResolver: jest.Mocked<AttachmentResolverPort> = { resolve: jest.fn().mockResolvedValue({ resolved: [], failure: null }) };
  const clock: ExecutionClock = { now: () => NOW };
  const readiness = { checkReadiness: jest.fn().mockResolvedValue({ ready: true, mailbox: mailbox(), blockingReasons: [] }) } as unknown as jest.Mocked<ConnectedMailboxReadinessService>;
  const rateLimiter = { check: jest.fn(), recordAttempt: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<ConnectedMailboxRateLimiterService>;
  const tokenVault: jest.Mocked<MailboxTokenVaultService> = {
    encryptRefreshToken: jest.fn(),
    encryptAccessToken: jest.fn().mockReturnValue({ ciphertext: 'enc(new-access-token)', keyVersion: 1 }),
    decryptRefreshToken: jest.fn().mockReturnValue('decrypted-refresh-token'),
    decryptAccessToken: jest.fn().mockReturnValue('decrypted-cached-access-token'),
  } as unknown as jest.Mocked<MailboxTokenVaultService>;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<EmailSecurityAuditService>;

  const service = new ConnectedMailboxSendService(mailboxes, sendAttempts, [providerAdapter], attachmentResolver, clock, readiness, rateLimiter, tokenVault, audit);
  return { service, mailboxes, sendAttempts, providerAdapter, attachmentResolver, readiness, rateLimiter, tokenVault, audit };
}

describe('ConnectedMailboxSendService', () => {
  describe('readiness gate', () => {
    it('never calls the provider or reserves a send attempt when the readiness gate blocks', async () => {
      const { service, readiness, sendAttempts, providerAdapter } = harness();
      readiness.checkReadiness.mockResolvedValue({ ready: false, mailbox: null, blockingReasons: ['No connected mailbox is set up for sending.'] });

      const { response } = await service.sendCandidateApplication(PARAMS);

      expect(response.accepted).toBe(false);
      expect(response.providerId).toBe('connected-mailbox-gate');
      expect(response.failure).toMatchObject({ category: 'UNSUPPORTED_CAPABILITY', retryable: false });
      expect(sendAttempts.reserve).not.toHaveBeenCalled();
      expect(providerAdapter.sendMessage).not.toHaveBeenCalled();
    });

    it('never falls back to any platform sender on a gate failure — the response is a synthesized block, not a different provider', async () => {
      const { service, readiness } = harness();
      readiness.checkReadiness.mockResolvedValue({ ready: false, mailbox: null, blockingReasons: ['blocked'] });
      const { response } = await service.sendCandidateApplication(PARAMS);
      expect(response.providerId).not.toBe('resend');
      expect(response.providerId).not.toBe('ses');
    });
  });

  describe('attachment resolution', () => {
    it('blocks and records CONNECTED_SEND_BLOCKED when attachment resolution fails, without reserving a send', async () => {
      const { service, attachmentResolver, sendAttempts, audit } = harness();
      attachmentResolver.resolve.mockResolvedValue({ resolved: [], failure: { reason: 'SCAN_REJECTED', documentId: 'doc-1', detail: 'malware marker detected' } });

      const params = { ...PARAMS, attachments: [{ fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 100, contentReference: 'doc-1' }] };
      const { response } = await service.sendCandidateApplication(params);

      expect(response.accepted).toBe(false);
      expect(response.providerId).toBe('connected-mailbox-gate');
      expect(sendAttempts.reserve).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'CONNECTED_SEND_BLOCKED' }));
    });

    it('passes the correct ownership/application context to the attachment resolver', async () => {
      const { service, attachmentResolver } = harness();
      const params = { ...PARAMS, attachments: [{ fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 100, contentReference: 'doc-1' }] };

      await service.sendCandidateApplication(params);

      expect(attachmentResolver.resolve).toHaveBeenCalledWith([{ documentId: 'doc-1', requestingUserId: 'user-1', applicationContextId: 'app-1' }]);
    });

    it('never calls the attachment resolver at all when there are no attachments', async () => {
      const { service, attachmentResolver } = harness();
      await service.sendCandidateApplication(PARAMS);
      expect(attachmentResolver.resolve).not.toHaveBeenCalled();
    });
  });

  describe('idempotency', () => {
    it('returns the frozen prior outcome for an already-SENT attempt without calling the provider again', async () => {
      const { service, sendAttempts, providerAdapter } = harness();
      sendAttempts.reserve.mockResolvedValue(sendAttempt({ status: 'SENT', providerMessageId: 'already-sent-msg', providerThreadId: 'already-sent-thread' }));

      const { response } = await service.sendCandidateApplication(PARAMS);

      expect(response.accepted).toBe(true);
      expect(response.providerMetadata).toMatchObject({ providerMessageId: 'already-sent-msg', providerThreadId: 'already-sent-thread' });
      expect(providerAdapter.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    it('sends using the cached access token when it has not expired, without a refresh call', async () => {
      const { service, providerAdapter, mailboxes } = harness();
      await service.sendCandidateApplication(PARAMS);
      expect(providerAdapter.refreshAccessToken).not.toHaveBeenCalled();
      expect(providerAdapter.sendMessage).toHaveBeenCalledWith('decrypted-cached-access-token', expect.objectContaining({ fromEmailAddress: 'jane@gmail.com', recipientEmailAddress: 'recruiter@example.de' }));
      expect(mailboxes.update).toHaveBeenCalledWith('mailbox-1', { lastSuccessfulSendAt: NOW }, NOW);
    });

    it('always builds the From address from the readiness-verified mailbox, never from caller input', async () => {
      const { service, readiness, providerAdapter } = harness();
      readiness.checkReadiness.mockResolvedValue({ ready: true, mailbox: mailbox({ emailAddress: 'the-real-verified-address@gmail.com' }), blockingReasons: [] });

      await service.sendCandidateApplication(PARAMS);

      expect(providerAdapter.sendMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ fromEmailAddress: 'the-real-verified-address@gmail.com' }));
    });

    it('records CONNECTED_SEND_STARTED then CONNECTED_SEND_ACCEPTED and increments the rate limiter on success', async () => {
      const { service, audit, rateLimiter, sendAttempts } = harness();
      await service.sendCandidateApplication(PARAMS);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'CONNECTED_SEND_STARTED' }));
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'CONNECTED_SEND_ACCEPTED' }));
      expect(rateLimiter.recordAttempt).toHaveBeenCalledWith('mailbox-1');
      expect(sendAttempts.markOutcome).toHaveBeenCalledWith('attempt-1', 'SENT', { providerMessageId: 'msg-1', providerThreadId: 'thread-1' }, NOW);
    });

    it('refreshes the access token exactly once when the cached one is within the 60s safety margin of expiring', async () => {
      const { service, providerAdapter, mailboxes, readiness, audit } = harness();
      readiness.checkReadiness.mockResolvedValue({ ready: true, mailbox: mailbox({ accessTokenExpiresAt: new Date(NOW.getTime() + 10_000) }), blockingReasons: [] });
      providerAdapter.refreshAccessToken.mockResolvedValue({ accessToken: 'fresh-access-token', expiresInSeconds: 3600, refreshToken: null });

      await service.sendCandidateApplication(PARAMS);

      expect(providerAdapter.refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(providerAdapter.sendMessage).toHaveBeenCalledWith('fresh-access-token', expect.anything());
      expect(mailboxes.update).toHaveBeenCalledWith('mailbox-1', expect.objectContaining({ encryptedAccessToken: 'enc(new-access-token)', lastRefreshedAt: NOW }), NOW);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'MAILBOX_TOKEN_REFRESHED' }));
    });

    it('persists a rotated refresh token when the provider issues one during refresh (e.g. Microsoft)', async () => {
      const { service, providerAdapter, tokenVault, mailboxes, readiness } = harness();
      readiness.checkReadiness.mockResolvedValue({ ready: true, mailbox: mailbox({ accessTokenExpiresAt: new Date(NOW.getTime()) }), blockingReasons: [] });
      providerAdapter.refreshAccessToken.mockResolvedValue({ accessToken: 'fresh-token', expiresInSeconds: 3600, refreshToken: 'rotated-refresh-token' });
      tokenVault.encryptRefreshToken.mockReturnValue({ ciphertext: 'enc(rotated-refresh-token)', keyVersion: 1 });

      await service.sendCandidateApplication(PARAMS);

      expect(tokenVault.encryptRefreshToken).toHaveBeenCalledWith('rotated-refresh-token');
      expect(mailboxes.update).toHaveBeenCalledWith('mailbox-1', expect.objectContaining({ encryptedRefreshToken: 'enc(rotated-refresh-token)' }), NOW);
    });

    it('forwards resolved attachment content and metadata into the provider send request', async () => {
      const { service, attachmentResolver, providerAdapter } = harness();
      attachmentResolver.resolve.mockResolvedValue({
        resolved: [{ documentId: 'doc-1', version: 2, fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 4, checksumSha256: 'abc', content: Buffer.from('test') }],
        failure: null,
      });
      const params = { ...PARAMS, attachments: [{ fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 4, contentReference: 'doc-1' }] };

      await service.sendCandidateApplication(params);

      expect(providerAdapter.sendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ resolvedAttachments: [{ fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 4, content: Buffer.from('test') }] }),
      );
    });
  });

  describe('token refresh failure', () => {
    it('marks the attempt FAILED with AUTHENTICATION, flips the mailbox to REAUTHORIZATION_REQUIRED, and never calls the provider send', async () => {
      const { service, providerAdapter, mailboxes, sendAttempts, audit, readiness } = harness();
      readiness.checkReadiness.mockResolvedValue({ ready: true, mailbox: mailbox({ accessTokenExpiresAt: new Date(NOW.getTime()) }), blockingReasons: [] });
      providerAdapter.refreshAccessToken.mockRejectedValue(new Error('invalid_grant: token revoked'));

      const { response } = await service.sendCandidateApplication(PARAMS);

      expect(providerAdapter.sendMessage).not.toHaveBeenCalled();
      expect(response.accepted).toBe(false);
      expect(response.failure).toMatchObject({ category: 'AUTHENTICATION' });
      expect(sendAttempts.markOutcome).toHaveBeenCalledWith('attempt-1', 'FAILED', expect.objectContaining({ lastFailureCategory: 'AUTHENTICATION' }), NOW);
      expect(mailboxes.update).toHaveBeenCalledWith('mailbox-1', expect.objectContaining({ status: 'REAUTHORIZATION_REQUIRED', reauthorizationRequired: true }), NOW);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'MAILBOX_REAUTHORIZATION_REQUIRED' }));
    });
  });

  describe('provider send failure', () => {
    it('marks FAILED and records CONNECTED_SEND_FAILED for a non-rate-limit failure', async () => {
      const { service, providerAdapter, sendAttempts, audit, mailboxes } = harness();
      providerAdapter.sendMessage.mockResolvedValue({ status: 'FAILED', accepted: false, providerMessageId: null, providerThreadId: null, rfcMessageId: null, providerMessage: 'bad request', failure: { category: 'UNKNOWN', message: 'bad request', retryable: false } });

      const { response } = await service.sendCandidateApplication(PARAMS);

      expect(response.accepted).toBe(false);
      expect(sendAttempts.markOutcome).toHaveBeenCalledWith('attempt-1', 'FAILED', expect.objectContaining({ lastFailureCategory: 'UNKNOWN' }), NOW);
      expect(mailboxes.update).toHaveBeenCalledWith('mailbox-1', expect.objectContaining({ failureCategory: 'UNKNOWN' }), NOW);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'CONNECTED_SEND_FAILED' }));
    });

    it('records CONNECTED_SEND_RATE_LIMITED instead of CONNECTED_SEND_FAILED when the provider throttles', async () => {
      const { service, providerAdapter, audit } = harness();
      providerAdapter.sendMessage.mockResolvedValue({ status: 'DEFERRED', accepted: false, providerMessageId: null, providerThreadId: null, rfcMessageId: null, providerMessage: 'quota exceeded', failure: { category: 'RATE_LIMITED', message: 'quota exceeded', retryable: true } });

      await service.sendCandidateApplication(PARAMS);

      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'CONNECTED_SEND_RATE_LIMITED' }));
    });

    it('still records recordAttempt on the rate limiter even for a failed send (a failed call still consumed real risk)', async () => {
      const { service, providerAdapter, rateLimiter } = harness();
      providerAdapter.sendMessage.mockResolvedValue({ status: 'FAILED', accepted: false, providerMessageId: null, providerThreadId: null, rfcMessageId: null, providerMessage: 'error', failure: { category: 'UNKNOWN', message: 'error', retryable: false } });

      await service.sendCandidateApplication(PARAMS);

      expect(rateLimiter.recordAttempt).toHaveBeenCalledWith('mailbox-1');
    });
  });
});
