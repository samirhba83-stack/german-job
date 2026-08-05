import { ConfigService } from '@nestjs/config';
import { SendGridEmailProviderAdapter } from './sendgrid-email-provider.adapter';
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

function fakeConfig(apiKey = 'test-key'): ConfigService {
  const values: Record<string, unknown> = { 'emailInfrastructure.sendgrid.apiKey': apiKey };
  return { get: (key: string, defaultValue?: unknown) => values[key] ?? defaultValue } as unknown as ConfigService;
}

const clock: ExecutionClock = { now: () => NOW };

function mockFetchSuccess(messageId: string) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    status: 202,
    headers: { get: (name: string) => (name === 'x-message-id' ? messageId : null) },
    json: async () => ({}),
  });
}

function mockFetchError(status: number, errors: { message: string }[]) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({ status, headers: { get: () => null }, json: async () => ({ errors }) });
}

describe('SendGridEmailProviderAdapter', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('honestly reports no attachment support', () => {
    const adapter = new SendGridEmailProviderAdapter(fakeConfig(), clock);
    expect(adapter.getCapabilities()).toMatchObject({ providerId: 'sendgrid', supportsAttachments: true, supportedAuthenticationMethods: ['API_KEY'] });
  });

  it('accepts a 202 and reads the provider message id from the X-Message-Id header', async () => {
    const adapter = new SendGridEmailProviderAdapter(fakeConfig(), clock);
    mockFetchSuccess('sg-msg-1');

    const result = await adapter.send(REQUEST);

    expect(result.accepted).toBe(true);
    expect(result.providerMetadata.providerMessageId).toBe('sg-msg-1');
  });

  it('maps 401 to AUTHENTICATION', async () => {
    const adapter = new SendGridEmailProviderAdapter(fakeConfig(), clock);
    mockFetchError(401, [{ message: 'unauthorized' }]);
    const result = await adapter.send(REQUEST);
    expect(result.failure).toMatchObject({ category: 'AUTHENTICATION', retryable: false });
  });

  it('maps 429 to RATE_LIMITED, retryable', async () => {
    const adapter = new SendGridEmailProviderAdapter(fakeConfig(), clock);
    mockFetchError(429, [{ message: 'too many requests' }]);
    const result = await adapter.send(REQUEST);
    expect(result.failure).toMatchObject({ category: 'RATE_LIMITED', retryable: true });
  });

  it('maps 400 to INVALID_RECIPIENT, non-retryable', async () => {
    const adapter = new SendGridEmailProviderAdapter(fakeConfig(), clock);
    mockFetchError(400, [{ message: 'invalid to address' }]);
    const result = await adapter.send(REQUEST);
    expect(result.failure).toMatchObject({ category: 'INVALID_RECIPIENT', retryable: false });
  });

  it('maps a 5xx response to PROVIDER_UNAVAILABLE, retryable', async () => {
    const adapter = new SendGridEmailProviderAdapter(fakeConfig(), clock);
    mockFetchError(503, [{ message: 'unavailable' }]);
    const result = await adapter.send(REQUEST);
    expect(result.failure).toMatchObject({ category: 'PROVIDER_UNAVAILABLE', retryable: true });
  });

  it('refuses to send without a configured API key', async () => {
    const adapter = new SendGridEmailProviderAdapter(fakeConfig(''), clock);
    const result = await adapter.send(REQUEST);
    expect(result.failure?.category).toBe('AUTHENTICATION');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a body-less request as UNSUPPORTED_CAPABILITY without calling fetch', async () => {
    const adapter = new SendGridEmailProviderAdapter(fakeConfig(), clock);
    const result = await adapter.send({ ...REQUEST, plainTextBody: null, htmlBody: null });
    expect(result.failure?.category).toBe('UNSUPPORTED_CAPABILITY');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  describe('M28.5 real attachment support', () => {
    it('refuses to send when attachments are declared but none were resolved to real bytes', async () => {
      const adapter = new SendGridEmailProviderAdapter(fakeConfig(), clock);
      const result = await adapter.send({ ...REQUEST, attachments: [{ fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 3, contentReference: 'doc-1' }] });
      expect(result.failure?.category).toBe('UNSUPPORTED_CAPABILITY');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('maps a resolved attachment to SendGrid\'s real attachment format (base64 content, filename, type, disposition)', async () => {
      const adapter = new SendGridEmailProviderAdapter(fakeConfig(), clock);
      mockFetchSuccess('sg-msg-2');
      const content = Buffer.from('%PDF-1.4 real cv bytes');

      await adapter.send({
        ...REQUEST,
        attachments: [{ fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: content.length, contentReference: 'doc-1' }],
        resolvedAttachments: [{ fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: content.length, content }],
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.attachments).toEqual([{ content: content.toString('base64'), filename: 'cv.pdf', type: 'application/pdf', disposition: 'attachment' }]);
    });

    it('includes reply_to as an object when the sender identity carries one', async () => {
      const adapter = new SendGridEmailProviderAdapter(fakeConfig(), clock);
      mockFetchSuccess('sg-msg-3');

      await adapter.send({ ...REQUEST, sender: { ...REQUEST.sender, replyToEmailAddress: 'candidate@example.com' } });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.reply_to).toEqual({ email: 'candidate@example.com' });
    });

    it('rejects an attachment set that would exceed SendGrid\'s documented 30MB size limit after base64 encoding', async () => {
      const adapter = new SendGridEmailProviderAdapter(fakeConfig(), clock);
      const oversized = Buffer.alloc(31 * 1024 * 1024, 'a');

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
