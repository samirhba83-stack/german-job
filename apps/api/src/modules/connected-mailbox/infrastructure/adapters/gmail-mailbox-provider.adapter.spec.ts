import { ConfigService } from '@nestjs/config';
import { GmailMailboxProviderAdapter } from './gmail-mailbox-provider.adapter';
import { MailboxSendRequest } from '../../domain/models/mailbox-send';

const SEND_REQUEST: MailboxSendRequest = {
  requestId: 'req-1',
  fromDisplayName: 'Jane Candidate',
  fromEmailAddress: 'jane@gmail.com',
  recipientEmailAddress: 'recruiter@example.de',
  subject: 'Application for Backend Engineer',
  plainTextBody: 'Please find my application attached.',
  htmlBody: null,
  resolvedAttachments: [],
};

function fakeConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = { 'connectedMailbox.google.clientId': 'client-id', 'connectedMailbox.google.clientSecret': 'client-secret', ...overrides };
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

describe('GmailMailboxProviderAdapter', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  describe('buildAuthorizationUrl', () => {
    it('builds a real Google consent URL with PKCE and offline/consent forcing', () => {
      const adapter = new GmailMailboxProviderAdapter(fakeConfig());
      const url = new URL(adapter.buildAuthorizationUrl({ state: 'the-state', codeChallenge: 'the-challenge', redirectUri: 'https://app.example.com/callback/google' }));

      expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url.searchParams.get('client_id')).toBe('client-id');
      expect(url.searchParams.get('state')).toBe('the-state');
      expect(url.searchParams.get('code_challenge')).toBe('the-challenge');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('access_type')).toBe('offline');
      expect(url.searchParams.get('prompt')).toBe('consent');
      expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email openid');
    });
  });

  describe('exchangeAuthorizationCode', () => {
    it('exchanges a real code for tokens and parses granted scopes', async () => {
      const adapter = new GmailMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(200, { access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600, scope: 'https://www.googleapis.com/auth/gmail.send openid' });

      const result = await adapter.exchangeAuthorizationCode('the-code', 'the-verifier', 'https://app.example.com/callback/google');

      expect(result).toEqual({
        accessToken: 'at-1',
        refreshToken: 'rt-1',
        expiresInSeconds: 3600,
        grantedScopes: ['https://www.googleapis.com/auth/gmail.send', 'openid'],
      });
    });

    it('throws when Google returns no access token', async () => {
      const adapter = new GmailMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(400, { error: 'invalid_grant', error_description: 'code expired' }, false);
      await expect(adapter.exchangeAuthorizationCode('bad-code', 'v', 'https://app.example.com/callback/google')).rejects.toThrow(/invalid_grant/);
    });

    it('reports no refresh token when Google omits one (e.g. a repeat consent without prompt=consent)', async () => {
      const adapter = new GmailMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(200, { access_token: 'at-1', expires_in: 3600, scope: 'openid' });
      const result = await adapter.exchangeAuthorizationCode('code', 'v', 'https://app.example.com/callback/google');
      expect(result.refreshToken).toBeNull();
    });
  });

  describe('refreshAccessToken', () => {
    it('refreshes and reports no rotated refresh token when Google keeps the same one (real Google behavior)', async () => {
      const adapter = new GmailMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(200, { access_token: 'at-2', expires_in: 3600 });
      const result = await adapter.refreshAccessToken('rt-1');
      expect(result).toEqual({ accessToken: 'at-2', expiresInSeconds: 3600, refreshToken: null });
    });

    it('throws when the refresh call fails (e.g. the grant was revoked)', async () => {
      const adapter = new GmailMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(400, { error: 'invalid_grant' }, false);
      await expect(adapter.refreshAccessToken('revoked-token')).rejects.toThrow();
    });
  });

  describe('revokeAuthorization', () => {
    it('never throws even if the revoke call fails (best-effort)', async () => {
      const adapter = new GmailMailboxProviderAdapter(fakeConfig());
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));
      await expect(adapter.revokeAuthorization('rt-1')).resolves.toBeUndefined();
    });
  });

  describe('getMailboxIdentity', () => {
    it('returns the real verified provider account id and email — never anything client-supplied', async () => {
      const adapter = new GmailMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(200, { sub: 'google-account-123', email: 'jane@gmail.com', name: 'Jane Candidate' });
      const identity = await adapter.getMailboxIdentity('at-1');
      expect(identity).toEqual({ providerAccountId: 'google-account-123', emailAddress: 'jane@gmail.com', displayName: 'Jane Candidate' });
    });

    it('throws when the userinfo response is missing sub or email', async () => {
      const adapter = new GmailMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(200, { email: 'jane@gmail.com' });
      await expect(adapter.getMailboxIdentity('at-1')).rejects.toThrow();
    });
  });

  describe('sendMessage', () => {
    it('accepts a successful send and surfaces the real Gmail message/thread id', async () => {
      const adapter = new GmailMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(200, { id: 'gmail-msg-1', threadId: 'gmail-thread-1' });

      const result = await adapter.sendMessage('at-1', SEND_REQUEST);

      expect(result).toMatchObject({ status: 'ACCEPTED', accepted: true, providerMessageId: 'gmail-msg-1', providerThreadId: 'gmail-thread-1', failure: null });
    });

    it('maps a 401 to AUTHENTICATION, non-retryable, FAILED status', async () => {
      const adapter = new GmailMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(401, { error: { message: 'invalid credentials' } }, false);
      const result = await adapter.sendMessage('expired-token', SEND_REQUEST);
      expect(result.status).toBe('FAILED');
      expect(result.failure).toMatchObject({ category: 'AUTHENTICATION', retryable: false });
    });

    it('maps a 429 to RATE_LIMITED, retryable, DEFERRED status', async () => {
      const adapter = new GmailMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(429, { error: { message: 'quota exceeded' } }, false);
      const result = await adapter.sendMessage('at-1', SEND_REQUEST);
      expect(result.status).toBe('DEFERRED');
      expect(result.failure).toMatchObject({ category: 'RATE_LIMITED', retryable: true });
    });

    it('maps a 500 to PROVIDER_UNAVAILABLE, retryable', async () => {
      const adapter = new GmailMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(500, { error: { message: 'internal error' } }, false);
      const result = await adapter.sendMessage('at-1', SEND_REQUEST);
      expect(result.failure).toMatchObject({ category: 'PROVIDER_UNAVAILABLE', retryable: true });
    });

    it('never throws on a network failure — returns a synthesized FAILED response instead', async () => {
      const adapter = new GmailMailboxProviderAdapter(fakeConfig());
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('ECONNRESET'));
      const result = await adapter.sendMessage('at-1', SEND_REQUEST);
      expect(result.status).toBe('FAILED');
      expect(result.failure).toMatchObject({ category: 'PROVIDER_UNAVAILABLE', retryable: true });
    });
  });

  describe('checkHealth', () => {
    it('reports healthy on a reachable profile endpoint', async () => {
      const adapter = new GmailMailboxProviderAdapter(fakeConfig());
      mockFetchOnce(200, { emailAddress: 'jane@gmail.com' });
      const result = await adapter.checkHealth('at-1');
      expect(result.healthy).toBe(true);
    });

    it('reports unhealthy without throwing on a network error', async () => {
      const adapter = new GmailMailboxProviderAdapter(fakeConfig());
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('down'));
      const result = await adapter.checkHealth('at-1');
      expect(result.healthy).toBe(false);
    });
  });
});
