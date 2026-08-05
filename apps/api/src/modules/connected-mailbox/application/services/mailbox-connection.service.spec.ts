import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailboxConnectionService } from './mailbox-connection.service';
import { ConnectedMailboxRepository } from '../../domain/ports/connected-mailbox.repository';
import { OAuthTransactionRepository } from '../../domain/ports/oauth-transaction.repository';
import { ConnectedMailboxProviderPort } from '../../domain/ports/connected-mailbox-provider.port';
import { ConnectedMailboxRecord } from '../../domain/models/connected-mailbox';
import { OAuthTransactionRecord } from '../../domain/models/oauth-transaction';
import { ExecutionClock } from '../../../execution/domain/ports/execution-clock.port';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { OAuthSecurityService } from './oauth-security.service';
import { MailboxTokenVaultService } from './mailbox-token-vault.service';

const NOW = new Date('2026-08-01T12:00:00.000Z');

function mailbox(overrides: Partial<ConnectedMailboxRecord> = {}): ConnectedMailboxRecord {
  return {
    id: 'mailbox-1',
    userId: 'user-1',
    provider: 'GOOGLE_GMAIL',
    providerAccountId: 'google-account-1',
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

function transaction(overrides: Partial<OAuthTransactionRecord> = {}): OAuthTransactionRecord {
  return {
    id: 'txn-1',
    state: 'the-state',
    userId: 'user-1',
    provider: 'GOOGLE_GMAIL',
    capability: 'SEND_APPLICATION_EMAIL',
    codeVerifier: 'verifier',
    redirectUri: 'https://app.example.com/callback/google',
    status: 'PENDING',
    expiresAt: new Date(NOW.getTime() + 600_000),
    consumedAt: null,
    createdAt: NOW,
    ...overrides,
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
  const transactions: jest.Mocked<OAuthTransactionRepository> = {
    create: jest.fn(),
    findByState: jest.fn(),
    tryConsume: jest.fn(),
  };
  const providerAdapter: jest.Mocked<ConnectedMailboxProviderPort> = {
    provider: 'GOOGLE_GMAIL',
    buildAuthorizationUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?...'),
    exchangeAuthorizationCode: jest.fn(),
    refreshAccessToken: jest.fn(),
    revokeAuthorization: jest.fn().mockResolvedValue(undefined),
    getMailboxIdentity: jest.fn(),
    sendMessage: jest.fn(),
    checkHealth: jest.fn(),
  };
  const clock: ExecutionClock = { now: () => NOW };
  const oauthSecurity: jest.Mocked<OAuthSecurityService> = {
    generateState: jest.fn().mockReturnValue('generated-state'),
    generateCodeVerifier: jest.fn().mockReturnValue('generated-verifier'),
    computeCodeChallenge: jest.fn().mockReturnValue('generated-challenge'),
  } as unknown as jest.Mocked<OAuthSecurityService>;
  const tokenVault: jest.Mocked<MailboxTokenVaultService> = {
    encryptRefreshToken: jest.fn().mockImplementation((plaintext: string) => ({ ciphertext: `enc(${plaintext})`, keyVersion: 1 })),
    encryptAccessToken: jest.fn().mockImplementation((plaintext: string) => ({ ciphertext: `enc(${plaintext})`, keyVersion: 1 })),
    decryptRefreshToken: jest.fn().mockReturnValue('decrypted-refresh-token'),
    decryptAccessToken: jest.fn().mockReturnValue('decrypted-access-token'),
  } as unknown as jest.Mocked<MailboxTokenVaultService>;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<EmailSecurityAuditService>;
  const config = { get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue) } as unknown as ConfigService;

  const service = new MailboxConnectionService(mailboxes, transactions, [providerAdapter], clock, oauthSecurity, tokenVault, audit, config);
  return { service, mailboxes, transactions, providerAdapter, oauthSecurity, tokenVault, audit };
}

describe('MailboxConnectionService', () => {
  describe('startConnection', () => {
    it('records a real transaction and returns the real provider authorization URL', async () => {
      const { service, transactions, audit } = harness();
      const result = await service.startConnection('user-1', 'GOOGLE_GMAIL');

      expect(result.authorizationUrl).toContain('accounts.google.com');
      expect(transactions.create).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'generated-state', userId: 'user-1', provider: 'GOOGLE_GMAIL', codeVerifier: 'generated-verifier' }),
        NOW,
      );
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'MAILBOX_CONNECTION_STARTED', userId: 'user-1' }));
    });
  });

  describe('completeConnection', () => {
    it('rejects an unknown/expired-from-cleanup state as INVALID_STATE', async () => {
      const { service, transactions } = harness();
      transactions.findByState.mockResolvedValue(null);
      const result = await service.completeConnection('unknown-state', 'code', null);
      expect(result).toEqual({ success: false, reason: 'INVALID_STATE', message: expect.any(String) });
    });

    it('rejects a genuinely expired transaction as EXPIRED, without consuming it', async () => {
      const { service, transactions } = harness();
      transactions.findByState.mockResolvedValue(transaction({ expiresAt: new Date(NOW.getTime() - 1000) }));
      const result = await service.completeConnection('the-state', 'code', null);
      expect(result).toMatchObject({ success: false, reason: 'EXPIRED' });
      expect(transactions.tryConsume).not.toHaveBeenCalled();
    });

    it('rejects a transaction that is already CONSUMED as ALREADY_CONSUMED, without a second tryConsume attempt', async () => {
      const { service, transactions } = harness();
      transactions.findByState.mockResolvedValue(transaction({ status: 'CONSUMED' }));
      const result = await service.completeConnection('the-state', 'code', null);
      expect(result).toMatchObject({ success: false, reason: 'ALREADY_CONSUMED' });
      expect(transactions.tryConsume).not.toHaveBeenCalled();
    });

    it('rejects as ALREADY_CONSUMED when a concurrent request wins the tryConsume race (single-use enforcement)', async () => {
      const { service, transactions } = harness();
      transactions.findByState.mockResolvedValue(transaction());
      transactions.tryConsume.mockResolvedValue(false);
      const result = await service.completeConnection('the-state', 'code', null);
      expect(result).toMatchObject({ success: false, reason: 'ALREADY_CONSUMED' });
    });

    it('rejects a provider-reported error without ever calling exchangeAuthorizationCode', async () => {
      const { service, transactions, providerAdapter, audit } = harness();
      transactions.findByState.mockResolvedValue(transaction());
      transactions.tryConsume.mockResolvedValue(true);
      const result = await service.completeConnection('the-state', null, 'access_denied');
      expect(result).toMatchObject({ success: false, reason: 'PROVIDER_ERROR' });
      expect(providerAdapter.exchangeAuthorizationCode).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'MAILBOX_CONNECTION_FAILED' }));
    });

    it('rejects a missing authorization code as MISSING_CODE', async () => {
      const { service, transactions, providerAdapter } = harness();
      transactions.findByState.mockResolvedValue(transaction());
      transactions.tryConsume.mockResolvedValue(true);
      const result = await service.completeConnection('the-state', null, null);
      expect(result).toMatchObject({ success: false, reason: 'MISSING_CODE' });
      expect(providerAdapter.exchangeAuthorizationCode).not.toHaveBeenCalled();
    });

    it('reports TOKEN_EXCHANGE_FAILED when the provider adapter throws during exchange', async () => {
      const { service, transactions, providerAdapter, audit } = harness();
      transactions.findByState.mockResolvedValue(transaction());
      transactions.tryConsume.mockResolvedValue(true);
      providerAdapter.exchangeAuthorizationCode.mockRejectedValue(new Error('invalid_grant'));

      const result = await service.completeConnection('the-state', 'the-code', null);
      expect(result).toMatchObject({ success: false, reason: 'TOKEN_EXCHANGE_FAILED' });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'MAILBOX_CONNECTION_FAILED' }));
    });

    it('reports SCOPE_REJECTED and never calls getMailboxIdentity when granted scopes are missing a requirement', async () => {
      const { service, transactions, providerAdapter, audit } = harness();
      transactions.findByState.mockResolvedValue(transaction());
      transactions.tryConsume.mockResolvedValue(true);
      providerAdapter.exchangeAuthorizationCode.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt', expiresInSeconds: 3600, grantedScopes: ['openid'] });

      const result = await service.completeConnection('the-state', 'the-code', null);
      expect(result).toMatchObject({ success: false, reason: 'SCOPE_REJECTED' });
      expect(providerAdapter.getMailboxIdentity).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'MAILBOX_SCOPE_REJECTED' }));
    });

    it('reports SCOPE_REJECTED when an unexpected broader scope was granted (fail closed on excess permission)', async () => {
      const { service, transactions, providerAdapter } = harness();
      transactions.findByState.mockResolvedValue(transaction());
      transactions.tryConsume.mockResolvedValue(true);
      providerAdapter.exchangeAuthorizationCode.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresInSeconds: 3600,
        grantedScopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email', 'openid', 'https://www.googleapis.com/auth/gmail.modify'],
      });

      const result = await service.completeConnection('the-state', 'the-code', null);
      expect(result).toMatchObject({ success: false, reason: 'SCOPE_REJECTED' });
    });

    it('reports IDENTITY_VERIFICATION_FAILED when the provider identity call throws', async () => {
      const { service, transactions, providerAdapter, audit } = harness();
      transactions.findByState.mockResolvedValue(transaction());
      transactions.tryConsume.mockResolvedValue(true);
      providerAdapter.exchangeAuthorizationCode.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresInSeconds: 3600,
        grantedScopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email', 'openid'],
      });
      providerAdapter.getMailboxIdentity.mockRejectedValue(new Error('userinfo unavailable'));

      const result = await service.completeConnection('the-state', 'the-code', null);
      expect(result).toMatchObject({ success: false, reason: 'IDENTITY_VERIFICATION_FAILED' });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'MAILBOX_CONNECTION_FAILED' }));
    });

    it('reports NO_REFRESH_TOKEN and never calls createConnected when the provider omits one', async () => {
      const { service, transactions, providerAdapter, mailboxes } = harness();
      transactions.findByState.mockResolvedValue(transaction());
      transactions.tryConsume.mockResolvedValue(true);
      providerAdapter.exchangeAuthorizationCode.mockResolvedValue({
        accessToken: 'at',
        refreshToken: null,
        expiresInSeconds: 3600,
        grantedScopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email', 'openid'],
      });
      providerAdapter.getMailboxIdentity.mockResolvedValue({ providerAccountId: 'acct-1', emailAddress: 'jane@gmail.com', displayName: 'Jane' });

      const result = await service.completeConnection('the-state', 'the-code', null);
      expect(result).toMatchObject({ success: false, reason: 'NO_REFRESH_TOKEN' });
      expect(mailboxes.createConnected).not.toHaveBeenCalled();
    });

    it('completes the full happy path: exchanges, verifies identity, encrypts tokens, creates the connected mailbox, and audits every step', async () => {
      const { service, transactions, providerAdapter, mailboxes, tokenVault, audit } = harness();
      transactions.findByState.mockResolvedValue(transaction());
      transactions.tryConsume.mockResolvedValue(true);
      providerAdapter.exchangeAuthorizationCode.mockResolvedValue({
        accessToken: 'real-access-token',
        refreshToken: 'real-refresh-token',
        expiresInSeconds: 3600,
        grantedScopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email', 'openid'],
      });
      providerAdapter.getMailboxIdentity.mockResolvedValue({ providerAccountId: 'acct-1', emailAddress: 'jane@gmail.com', displayName: 'Jane Candidate' });
      mailboxes.findActiveByUserId.mockResolvedValue(null);
      mailboxes.createConnected.mockResolvedValue(mailbox());

      const result = await service.completeConnection('the-state', 'the-code', null);

      expect(result.success).toBe(true);
      expect(tokenVault.encryptRefreshToken).toHaveBeenCalledWith('real-refresh-token');
      expect(tokenVault.encryptAccessToken).toHaveBeenCalledWith('real-access-token');
      expect(mailboxes.createConnected).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', provider: 'GOOGLE_GMAIL', providerAccountId: 'acct-1', emailAddress: 'jane@gmail.com', hasRefreshToken: true }),
        NOW,
      );
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'MAILBOX_IDENTITY_VERIFIED' }));
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'MAILBOX_CONNECTION_COMPLETED' }));
    });

    it('never trusts a frontend-supplied email — the connected email/account id come only from getMailboxIdentity', async () => {
      const { service, transactions, providerAdapter, mailboxes } = harness();
      transactions.findByState.mockResolvedValue(transaction());
      transactions.tryConsume.mockResolvedValue(true);
      providerAdapter.exchangeAuthorizationCode.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresInSeconds: 3600,
        grantedScopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email', 'openid'],
      });
      providerAdapter.getMailboxIdentity.mockResolvedValue({ providerAccountId: 'real-verified-account', emailAddress: 'real-verified@gmail.com', displayName: null });
      mailboxes.findActiveByUserId.mockResolvedValue(null);
      mailboxes.createConnected.mockResolvedValue(mailbox());

      await service.completeConnection('the-state', 'the-code', null);

      expect(mailboxes.createConnected).toHaveBeenCalledWith(
        expect.objectContaining({ providerAccountId: 'real-verified-account', emailAddress: 'real-verified@gmail.com' }),
        NOW,
      );
    });
  });

  describe('disconnect', () => {
    it('throws NotFoundException when the mailbox does not exist', async () => {
      const { service, mailboxes } = harness();
      mailboxes.findById.mockResolvedValue(null);
      await expect(service.disconnect('user-1', 'missing-id')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException (never a distinguishable "forbidden") when the mailbox belongs to a different user', async () => {
      const { service, mailboxes } = harness();
      mailboxes.findById.mockResolvedValue(mailbox({ userId: 'someone-else' }));
      await expect(service.disconnect('user-1', 'mailbox-1')).rejects.toThrow(NotFoundException);
    });

    it('revokes with the provider, destroys stored tokens, and records MAILBOX_DISCONNECTED', async () => {
      const { service, mailboxes, providerAdapter, tokenVault, audit } = harness();
      mailboxes.findById.mockResolvedValue(mailbox());
      mailboxes.update.mockResolvedValue(mailbox({ status: 'USER_DISABLED' }));

      await service.disconnect('user-1', 'mailbox-1');

      expect(tokenVault.decryptRefreshToken).toHaveBeenCalled();
      expect(providerAdapter.revokeAuthorization).toHaveBeenCalledWith('decrypted-refresh-token');
      expect(mailboxes.update).toHaveBeenCalledWith(
        'mailbox-1',
        expect.objectContaining({ status: 'USER_DISABLED', userDisabled: true, isActive: false, encryptedRefreshToken: null, encryptedAccessToken: null, hasRefreshToken: false }),
        NOW,
      );
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'MAILBOX_DISCONNECTED', userId: 'user-1', connectedMailboxId: 'mailbox-1' }));
    });

    it('still completes local disconnection even when the provider revoke call fails (best-effort)', async () => {
      const { service, mailboxes, providerAdapter } = harness();
      mailboxes.findById.mockResolvedValue(mailbox());
      mailboxes.update.mockResolvedValue(mailbox({ status: 'USER_DISABLED' }));
      providerAdapter.revokeAuthorization.mockRejectedValue(new Error('provider unreachable'));

      await expect(service.disconnect('user-1', 'mailbox-1')).resolves.toBeUndefined();
      expect(mailboxes.update).toHaveBeenCalled();
    });

    it('skips the provider revoke call entirely when there is no stored refresh token', async () => {
      const { service, mailboxes, providerAdapter } = harness();
      mailboxes.findById.mockResolvedValue(mailbox({ encryptedRefreshToken: null }));
      mailboxes.update.mockResolvedValue(mailbox({ status: 'USER_DISABLED' }));

      await service.disconnect('user-1', 'mailbox-1');
      expect(providerAdapter.revokeAuthorization).not.toHaveBeenCalled();
    });
  });

  describe('admin operations', () => {
    it('adminSuspend sets SYSTEM_SUSPENDED and records the acting admin id and reason, keyed to the mailbox owner', async () => {
      const { service, mailboxes, audit } = harness();
      mailboxes.findById.mockResolvedValue(mailbox());
      mailboxes.update.mockResolvedValue(mailbox({ status: 'SYSTEM_SUSPENDED', systemSuspended: true }));

      await service.adminSuspend('mailbox-1', 'admin-1', 'suspicious activity');

      expect(mailboxes.update).toHaveBeenCalledWith('mailbox-1', expect.objectContaining({ status: 'SYSTEM_SUSPENDED', systemSuspended: true, suspensionReason: 'suspicious activity' }), NOW);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'MAILBOX_SYSTEM_SUSPENDED', userId: 'user-1', connectedMailboxId: 'mailbox-1', detail: expect.stringContaining('admin-1') }),
      );
    });

    it('adminSuspend throws NotFoundException for a missing mailbox', async () => {
      const { service, mailboxes } = harness();
      mailboxes.findById.mockResolvedValue(null);
      await expect(service.adminSuspend('missing', 'admin-1', 'reason')).rejects.toThrow(NotFoundException);
    });

    it('adminRestore returns to CONNECTED when a valid refresh token is still on file', async () => {
      const { service, mailboxes } = harness();
      mailboxes.findById.mockResolvedValue(mailbox({ status: 'SYSTEM_SUSPENDED', systemSuspended: true, hasRefreshToken: true }));
      mailboxes.update.mockResolvedValue(mailbox());

      await service.adminRestore('mailbox-1', 'admin-1', 'reviewed, safe');
      expect(mailboxes.update).toHaveBeenCalledWith('mailbox-1', expect.objectContaining({ status: 'CONNECTED', systemSuspended: false, suspensionReason: null }), NOW);
    });

    it('adminRestore falls back to REAUTHORIZATION_REQUIRED when no refresh token remains', async () => {
      const { service, mailboxes } = harness();
      mailboxes.findById.mockResolvedValue(mailbox({ status: 'SYSTEM_SUSPENDED', hasRefreshToken: false }));
      mailboxes.update.mockResolvedValue(mailbox());

      await service.adminRestore('mailbox-1', 'admin-1', 'reviewed');
      expect(mailboxes.update).toHaveBeenCalledWith('mailbox-1', expect.objectContaining({ status: 'REAUTHORIZATION_REQUIRED', reauthorizationRequired: true }), NOW);
    });

    it('adminForceReauthorization sets REAUTHORIZATION_REQUIRED and records the reason', async () => {
      const { service, mailboxes, audit } = harness();
      mailboxes.findById.mockResolvedValue(mailbox());
      mailboxes.update.mockResolvedValue(mailbox({ status: 'REAUTHORIZATION_REQUIRED', reauthorizationRequired: true }));

      await service.adminForceReauthorization('mailbox-1', 'admin-1', 'scope audit');
      expect(mailboxes.update).toHaveBeenCalledWith('mailbox-1', { status: 'REAUTHORIZATION_REQUIRED', reauthorizationRequired: true }, NOW);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'MAILBOX_REAUTHORIZATION_REQUIRED', detail: expect.stringContaining('scope audit') }));
    });

    it('adminDisconnect revokes, destroys tokens, sets REVOKED, and records MAILBOX_REVOKED (distinct from user-initiated MAILBOX_DISCONNECTED)', async () => {
      const { service, mailboxes, providerAdapter, audit } = harness();
      mailboxes.findById.mockResolvedValue(mailbox());
      mailboxes.update.mockResolvedValue(mailbox({ status: 'REVOKED' }));

      await service.adminDisconnect('mailbox-1', 'admin-1', 'compromised — reported by user');

      expect(providerAdapter.revokeAuthorization).toHaveBeenCalled();
      expect(mailboxes.update).toHaveBeenCalledWith(
        'mailbox-1',
        expect.objectContaining({ status: 'REVOKED', isActive: false, encryptedRefreshToken: null, encryptedAccessToken: null, hasRefreshToken: false }),
        NOW,
      );
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'MAILBOX_REVOKED', detail: expect.stringContaining('admin-1') }));
    });

    it('adminDisconnect does not throw even if best-effort provider revocation fails', async () => {
      const { service, mailboxes, providerAdapter } = harness();
      mailboxes.findById.mockResolvedValue(mailbox());
      mailboxes.update.mockResolvedValue(mailbox({ status: 'REVOKED' }));
      providerAdapter.revokeAuthorization.mockRejectedValue(new Error('provider unreachable'));

      await expect(service.adminDisconnect('mailbox-1', 'admin-1', 'reason')).resolves.toBeDefined();
    });
  });
});
