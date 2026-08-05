import { ConfigService } from '@nestjs/config';
import { MicrosoftOutlookMailboxProviderAdapter } from './microsoft-outlook-mailbox-provider.adapter';
import { MailboxSendRequest } from '../../domain/models/mailbox-send';

const SEND_REQUEST: MailboxSendRequest = {
  requestId: 'req-1',
  fromDisplayName: 'Jane Candidate',
  fromEmailAddress: 'jane@outlook.com',
  recipientEmailAddress: 'recruiter@example.de',
  subject: 'Application for Backend Engineer',
  plainTextBody: 'Please find my application attached.',
  htmlBody: null,
  resolvedAttachments: [],
};

function fakeConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    'connectedMailbox.microsoft.clientId': 'client-id',
    'connectedMailbox.microsoft.clientSecret': 'client-secret',
    'connectedMailbox.microsoft.tenant': 'common',
    ...overrides,
  };
  return { get: (key: string, defaultValue?: unknown) => values[key] ?? defaultValue } as unknown as ConfigService;
}

function mockFetchOnce(status: number, body: unknown, ok = status >= 200 && status < 300, headers: Record<string, string> = {}) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    status,
    json: async () => body,
    headers: { get: (name: string) => headers[name] ?? null },
  });
}

describe('MicrosoftOutlookMailboxProviderAdapter', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  describe('buildAuthorizationUrl', () => {
    it('builds a real Microsoft identity platform consent URL with PKCE, defaulting to the "common" tenant', () => {
      const adapter = new MicrosoftOutlookMailboxProviderAdapter(fakeConfig());
      const url = new URL(adapter.buildAuthorizationUrl({ state: 'the-state', codeChallenge: 'the-challenge', redirectUri: 'https://app.example.com/callback/microsoft' }));

      expect(url.origin + url.pathname).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
      expect(url.searchParams.get('client_id')).toBe('client-id');
      expect(url.searchParams.get('code_challenge')).toBe('the-challenge');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('scope')).toBe('https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access openid');
    });

    it('uses a configured tenant instead of "common" when set', () => {
      const adapter = new MicrosoftOutlookMailboxProviderAdapter(fakeConfig({ 'connectedMailbox.microsoft.tenant': 'my-org-tenant-id' }));
      const url = new URL(adapter.buildAuthorizationUrl({ state: 's', codeChallenge: 'c', redirectUri: 'https://app.example.com/callback/microsoft' }));
      expect(url.pathname).toContain('my-org-tenant-id');
    });
  });

  describe('exchangeAuthorizationCode', () => {
    it('exchanges a real code for tokens', async () => {
      const adapter = new MicrosoftOutlookMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(200, { access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600, scope: 'Mail.Send User.Read offline_access openid' });
      const result = await adapter.exchangeAuthorizationCode('code', 'verifier', 'https://app.example.com/callback/microsoft');
      expect(result).toEqual({ accessToken: 'at-1', refreshToken: 'rt-1', expiresInSeconds: 3600, grantedScopes: ['Mail.Send', 'User.Read', 'offline_access', 'openid'] });
    });

    it('throws when Microsoft returns no access token', async () => {
      const adapter = new MicrosoftOutlookMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(400, { error: 'invalid_grant', error_description: 'code expired' }, false);
      await expect(adapter.exchangeAuthorizationCode('bad', 'v', 'https://app.example.com/callback/microsoft')).rejects.toThrow(/invalid_grant/);
    });
  });

  describe('refreshAccessToken', () => {
    it('always surfaces a rotated refresh token (real Microsoft behavior — never reuse the old one)', async () => {
      const adapter = new MicrosoftOutlookMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(200, { access_token: 'at-2', refresh_token: 'rt-2-rotated', expires_in: 3600 });
      const result = await adapter.refreshAccessToken('rt-1');
      expect(result.refreshToken).toBe('rt-2-rotated');
    });

    it('throws when the refresh call fails', async () => {
      const adapter = new MicrosoftOutlookMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(400, { error: 'invalid_grant' }, false);
      await expect(adapter.refreshAccessToken('revoked')).rejects.toThrow();
    });
  });

  describe('revokeAuthorization', () => {
    it('never calls the network and never throws — Graph has no scoped per-app revocation API, so this is a documented no-op', async () => {
      const adapter = new MicrosoftOutlookMailboxProviderAdapter(fakeConfig());
      await expect(adapter.revokeAuthorization('rt-1')).resolves.toBeUndefined();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('getMailboxIdentity', () => {
    it('returns the real verified provider account id and mail address', async () => {
      const adapter = new MicrosoftOutlookMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(200, { id: 'graph-account-123', mail: 'jane@outlook.com', displayName: 'Jane Candidate' });
      const identity = await adapter.getMailboxIdentity('at-1');
      expect(identity).toEqual({ providerAccountId: 'graph-account-123', emailAddress: 'jane@outlook.com', displayName: 'Jane Candidate' });
    });

    it('falls back to userPrincipalName when mail is null (a real Graph quirk for some tenants)', async () => {
      const adapter = new MicrosoftOutlookMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(200, { id: 'graph-account-123', mail: null, userPrincipalName: 'jane@tenant.onmicrosoft.com' });
      const identity = await adapter.getMailboxIdentity('at-1');
      expect(identity.emailAddress).toBe('jane@tenant.onmicrosoft.com');
    });

    it('throws when neither mail nor userPrincipalName is present', async () => {
      const adapter = new MicrosoftOutlookMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(200, { id: 'graph-account-123' });
      await expect(adapter.getMailboxIdentity('at-1')).rejects.toThrow();
    });
  });

  describe('sendMessage', () => {
    it('uses the real two-step create-draft-then-send flow and surfaces the draft id/conversation id', async () => {
      const adapter = new MicrosoftOutlookMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(201, { id: 'draft-1', conversationId: 'conv-1' });
      mockFetchOnce(202, {});

      const result = await adapter.sendMessage('at-1', SEND_REQUEST);

      expect(global.fetch).toHaveBeenNthCalledWith(1, 'https://graph.microsoft.com/v1.0/me/messages', expect.objectContaining({ method: 'POST' }));
      expect(global.fetch).toHaveBeenNthCalledWith(2, 'https://graph.microsoft.com/v1.0/me/messages/draft-1/send', expect.objectContaining({ method: 'POST' }));
      expect(result).toMatchObject({ status: 'ACCEPTED', accepted: true, providerMessageId: 'draft-1', providerThreadId: 'conv-1', failure: null });
    });

    it('fails the draft-creation step without ever calling the send step', async () => {
      const adapter = new MicrosoftOutlookMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(401, { error: { message: 'invalid credentials' } }, false);

      const result = await adapter.sendMessage('expired', SEND_REQUEST);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('FAILED');
      expect(result.failure).toMatchObject({ category: 'AUTHENTICATION', retryable: false });
    });

    it('maps a 429 with Retry-After into a RATE_LIMITED, retryable, DEFERRED response', async () => {
      const adapter = new MicrosoftOutlookMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(429, { error: { message: 'throttled' } }, false, { 'retry-after': '30' });

      const result = await adapter.sendMessage('at-1', SEND_REQUEST);

      expect(result.status).toBe('DEFERRED');
      expect(result.failure).toMatchObject({ category: 'RATE_LIMITED', retryable: true });
      expect(result.providerMessage).toContain('Retry-After: 30s');
    });

    it('fails the send step if the draft was created but the subsequent send call fails', async () => {
      const adapter = new MicrosoftOutlookMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(201, { id: 'draft-1', conversationId: 'conv-1' });
      mockFetchOnce(500, { error: { message: 'internal error' } }, false);

      const result = await adapter.sendMessage('at-1', SEND_REQUEST);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.failure).toMatchObject({ category: 'PROVIDER_UNAVAILABLE', retryable: true });
    });

    it('rejects attachments exceeding the 3MB inline ceiling before making any network call', async () => {
      const adapter = new MicrosoftOutlookMailboxProviderAdapter(fakeConfig());
      const oversized: MailboxSendRequest = {
        ...SEND_REQUEST,
        resolvedAttachments: [{ fileName: 'huge.pdf', mimeType: 'application/pdf', content: Buffer.alloc(4 * 1024 * 1024), sizeBytes: 4 * 1024 * 1024 }],
      };

      const result = await adapter.sendMessage('at-1', oversized);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.status).toBe('UNSUPPORTED');
      expect(result.failure).toMatchObject({ category: 'UNSUPPORTED_CAPABILITY', retryable: false });
    });

    it('never throws on a network failure — returns a synthesized FAILED response instead', async () => {
      const adapter = new MicrosoftOutlookMailboxProviderAdapter(fakeConfig());
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('ECONNRESET'));
      const result = await adapter.sendMessage('at-1', SEND_REQUEST);
      expect(result.status).toBe('FAILED');
      expect(result.failure).toMatchObject({ category: 'PROVIDER_UNAVAILABLE', retryable: true });
    });
  });

  describe('checkHealth', () => {
    it('reports healthy when /me is reachable', async () => {
      const adapter = new MicrosoftOutlookMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(200, { mail: 'jane@outlook.com' });
      const result = await adapter.checkHealth('at-1');
      expect(result.healthy).toBe(true);
    });

    it('reports unhealthy without throwing on a network error', async () => {
      const adapter = new MicrosoftOutlookMailboxProviderAdapter(fakeConfig());
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('down'));
      const result = await adapter.checkHealth('at-1');
      expect(result.healthy).toBe(false);
    });
  });
});
