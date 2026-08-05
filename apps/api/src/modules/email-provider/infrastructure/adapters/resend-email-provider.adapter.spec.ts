import { ConfigService } from '@nestjs/config';
import { ResendEmailProviderAdapter } from './resend-email-provider.adapter';
import { EmailDeliveryRequest } from '../../domain/models/email-delivery-request';
import { ExecutionClock } from '../../../execution/domain/ports/execution-clock.port';

const NOW = new Date('2026-08-01T12:00:00.000Z');

const REQUEST: EmailDeliveryRequest = {
  requestId: 'req-1',
  sender: { displayName: 'German Job Engine', emailAddress: 'noreply@example.com' },
  recipientEmailAddress: 'recruiter@example.de',
  subject: 'Application',
  plainTextBody: 'Hello',
  htmlBody: null,
  attachments: [],
};

function fakeConfig(apiKey = 'test-key', dailyLimit: number | null = null): ConfigService {
  const values: Record<string, unknown> = { 'emailInfrastructure.resend.apiKey': apiKey, 'emailInfrastructure.resend.dailyLimit': dailyLimit };
  return { get: (key: string, defaultValue?: unknown) => values[key] ?? defaultValue } as unknown as ConfigService;
}

const clock: ExecutionClock = { now: () => NOW };

function mockFetchOnce(status: number, body: unknown, ok = status >= 200 && status < 300) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok, status, json: async () => body });
}

describe('ResendEmailProviderAdapter', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('honestly reports no attachment support and the API-key auth method', () => {
    const adapter = new ResendEmailProviderAdapter(fakeConfig('key', 500), clock);
    expect(adapter.getCapabilities()).toMatchObject({ providerId: 'resend', supportsAttachments: true, dailyDeliveryLimit: 500, supportedAuthenticationMethods: ['API_KEY'] });
  });

  it('isAvailable is false without a configured API key', async () => {
    const adapter = new ResendEmailProviderAdapter(fakeConfig(''), clock);
    await expect(adapter.isAvailable()).resolves.toBe(false);
  });

  it('accepts a successful send and surfaces providerMessageId', async () => {
    const adapter = new ResendEmailProviderAdapter(fakeConfig(), clock);
    mockFetchOnce(200, { id: 'resend-msg-1' });

    const result = await adapter.send(REQUEST);

    expect(result.accepted).toBe(true);
    expect(result.status).toBe('ACCEPTED');
    expect(result.providerMetadata.providerMessageId).toBe('resend-msg-1');
  });

  it('maps 401 to AUTHENTICATION, non-retryable', async () => {
    const adapter = new ResendEmailProviderAdapter(fakeConfig(), clock);
    mockFetchOnce(401, { message: 'bad key' });
    const result = await adapter.send(REQUEST);
    expect(result.failure).toMatchObject({ category: 'AUTHENTICATION', retryable: false });
  });

  it('maps 429 to RATE_LIMITED, retryable, DEFERRED status', async () => {
    const adapter = new ResendEmailProviderAdapter(fakeConfig(), clock);
    mockFetchOnce(429, { message: 'slow down' });
    const result = await adapter.send(REQUEST);
    expect(result.failure).toMatchObject({ category: 'RATE_LIMITED', retryable: true });
    expect(result.status).toBe('DEFERRED');
  });

  it('maps 422 to INVALID_RECIPIENT, non-retryable, REJECTED status', async () => {
    const adapter = new ResendEmailProviderAdapter(fakeConfig(), clock);
    mockFetchOnce(422, { message: 'invalid address' });
    const result = await adapter.send(REQUEST);
    expect(result.failure).toMatchObject({ category: 'INVALID_RECIPIENT', retryable: false });
    expect(result.status).toBe('REJECTED');
  });

  it('maps a 500 response to PROVIDER_UNAVAILABLE, retryable', async () => {
    const adapter = new ResendEmailProviderAdapter(fakeConfig(), clock);
    mockFetchOnce(500, { message: 'server error' });
    const result = await adapter.send(REQUEST);
    expect(result.failure).toMatchObject({ category: 'PROVIDER_UNAVAILABLE', retryable: true });
  });

  it('maps a thrown network error to PROVIDER_UNAVAILABLE, retryable', async () => {
    const adapter = new ResendEmailProviderAdapter(fakeConfig(), clock);
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('ECONNRESET'));
    const result = await adapter.send(REQUEST);
    expect(result.failure).toMatchObject({ category: 'PROVIDER_UNAVAILABLE', retryable: true });
  });

  it('refuses to send without a configured API key, without ever calling fetch', async () => {
    const adapter = new ResendEmailProviderAdapter(fakeConfig(''), clock);
    const result = await adapter.send(REQUEST);
    expect(result.failure?.category).toBe('AUTHENTICATION');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a request with neither an HTML nor a plain-text body as UNSUPPORTED_CAPABILITY', async () => {
    const adapter = new ResendEmailProviderAdapter(fakeConfig(), clock);
    const result = await adapter.send({ ...REQUEST, plainTextBody: null, htmlBody: null });
    expect(result.failure?.category).toBe('UNSUPPORTED_CAPABILITY');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  describe('M28.5 real attachment support', () => {
    it('refuses to send when attachments are declared but none were resolved to real bytes', async () => {
      const adapter = new ResendEmailProviderAdapter(fakeConfig(), clock);
      const result = await adapter.send({ ...REQUEST, attachments: [{ fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 3, contentReference: 'doc-1' }] });
      expect(result.failure?.category).toBe('UNSUPPORTED_CAPABILITY');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('sends a real base64-encoded attachment payload in the Resend request body', async () => {
      const adapter = new ResendEmailProviderAdapter(fakeConfig(), clock);
      mockFetchOnce(200, { id: 'resend-msg-2' });
      const content = Buffer.from('%PDF-1.4 real cv bytes');

      await adapter.send({
        ...REQUEST,
        attachments: [{ fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: content.length, contentReference: 'doc-1' }],
        resolvedAttachments: [{ fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: content.length, content }],
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.attachments).toEqual([{ filename: 'cv.pdf', content: content.toString('base64') }]);
    });

    it('includes reply_to in the request body when the sender identity carries one', async () => {
      const adapter = new ResendEmailProviderAdapter(fakeConfig(), clock);
      mockFetchOnce(200, { id: 'resend-msg-3' });

      await adapter.send({ ...REQUEST, sender: { ...REQUEST.sender, replyToEmailAddress: 'candidate@example.com' } });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.reply_to).toBe('candidate@example.com');
    });

    it('rejects an attachment set that would exceed Resend\'s documented size limit after base64 encoding', async () => {
      const adapter = new ResendEmailProviderAdapter(fakeConfig(), clock);
      const oversized = Buffer.alloc(41 * 1024 * 1024, 'a'); // 41MB > Resend's 40MB documented limit

      const result = await adapter.send({
        ...REQUEST,
        attachments: [{ fileName: 'huge.pdf', mimeType: 'application/pdf', sizeBytes: oversized.length, contentReference: 'doc-1' }],
        resolvedAttachments: [{ fileName: 'huge.pdf', mimeType: 'application/pdf', sizeBytes: oversized.length, content: oversized }],
      });

      expect(result.failure).toMatchObject({ category: 'PROVIDER_UNAVAILABLE', retryable: true });
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
