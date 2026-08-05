import { ConfigService } from '@nestjs/config';
import { ExecutionClock } from '../../../execution/domain/ports/execution-clock.port';
import { EmailDeliveryRequest } from '../../domain/models/email-delivery-request';

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-ses', () => ({
  SESClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  SendRawEmailCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

// Import after the mock so the adapter picks up the mocked SDK.
import { SesEmailProviderAdapter } from './ses-email-provider.adapter';

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

function fakeConfig(configured = true): ConfigService {
  const values: Record<string, unknown> = configured
    ? { 'emailInfrastructure.ses.region': 'eu-central-1', 'emailInfrastructure.ses.accessKeyId': 'AKIA...', 'emailInfrastructure.ses.secretAccessKey': 'secret' }
    : { 'emailInfrastructure.ses.region': '', 'emailInfrastructure.ses.accessKeyId': '', 'emailInfrastructure.ses.secretAccessKey': '' };
  return { get: (key: string, defaultValue?: unknown) => values[key] ?? defaultValue } as unknown as ConfigService;
}

const clock: ExecutionClock = { now: () => NOW };

describe('SesEmailProviderAdapter', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('honestly reports real attachment support', () => {
    const adapter = new SesEmailProviderAdapter(fakeConfig(), clock);
    expect(adapter.getCapabilities()).toMatchObject({ providerId: 'ses', supportsAttachments: true });
  });

  it('isAvailable is false when credentials are incomplete', async () => {
    const adapter = new SesEmailProviderAdapter(fakeConfig(false), clock);
    await expect(adapter.isAvailable()).resolves.toBe(false);
  });

  it('accepts a successful send and surfaces the SES MessageId as providerMessageId', async () => {
    const adapter = new SesEmailProviderAdapter(fakeConfig(), clock);
    mockSend.mockResolvedValueOnce({ MessageId: 'ses-msg-1' });

    const result = await adapter.send(REQUEST);

    expect(result.accepted).toBe(true);
    expect(result.providerMetadata.providerMessageId).toBe('ses-msg-1');
  });

  it('maps MessageRejected to INVALID_RECIPIENT, non-retryable', async () => {
    const adapter = new SesEmailProviderAdapter(fakeConfig(), clock);
    const error = Object.assign(new Error('Email address is not verified'), { name: 'MessageRejected' });
    mockSend.mockRejectedValueOnce(error);

    const result = await adapter.send(REQUEST);
    expect(result.failure).toMatchObject({ category: 'INVALID_RECIPIENT', retryable: false });
  });

  it('maps Throttling to RATE_LIMITED, retryable', async () => {
    const adapter = new SesEmailProviderAdapter(fakeConfig(), clock);
    const error = Object.assign(new Error('Rate exceeded'), { name: 'ThrottlingException' });
    mockSend.mockRejectedValueOnce(error);

    const result = await adapter.send(REQUEST);
    expect(result.failure).toMatchObject({ category: 'RATE_LIMITED', retryable: true });
  });

  it('maps an authentication-related AWS error name to AUTHENTICATION', async () => {
    const adapter = new SesEmailProviderAdapter(fakeConfig(), clock);
    const error = Object.assign(new Error('bad credentials'), { name: 'InvalidClientTokenId' });
    mockSend.mockRejectedValueOnce(error);

    const result = await adapter.send(REQUEST);
    expect(result.failure).toMatchObject({ category: 'AUTHENTICATION', retryable: false });
  });

  it('maps an unrecognized AWS error with a 5xx metadata status to PROVIDER_UNAVAILABLE, retryable', async () => {
    const adapter = new SesEmailProviderAdapter(fakeConfig(), clock);
    const error = Object.assign(new Error('internal failure'), { name: 'InternalFailure', $metadata: { httpStatusCode: 500 } });
    mockSend.mockRejectedValueOnce(error);

    const result = await adapter.send(REQUEST);
    expect(result.failure).toMatchObject({ category: 'PROVIDER_UNAVAILABLE', retryable: true });
  });

  it('refuses to send with incomplete credentials, without ever constructing a command', async () => {
    const adapter = new SesEmailProviderAdapter(fakeConfig(false), clock);
    const result = await adapter.send(REQUEST);
    expect(result.failure?.category).toBe('AUTHENTICATION');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('rejects a body-less request as UNSUPPORTED_CAPABILITY', async () => {
    const adapter = new SesEmailProviderAdapter(fakeConfig(), clock);
    const result = await adapter.send({ ...REQUEST, plainTextBody: null, htmlBody: null });
    expect(result.failure?.category).toBe('UNSUPPORTED_CAPABILITY');
    expect(mockSend).not.toHaveBeenCalled();
  });

  describe('M28.5 real attachment support (SendRawEmailCommand + hand-built MIME)', () => {
    it('refuses to send when attachments are declared but none were resolved to real bytes', async () => {
      const adapter = new SesEmailProviderAdapter(fakeConfig(), clock);
      const result = await adapter.send({ ...REQUEST, attachments: [{ fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 3, contentReference: 'doc-1' }] });
      expect(result.failure?.category).toBe('UNSUPPORTED_CAPABILITY');
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('builds a real raw MIME message containing the base64-encoded attachment and sends it via SendRawEmailCommand', async () => {
      const adapter = new SesEmailProviderAdapter(fakeConfig(), clock);
      mockSend.mockResolvedValueOnce({ MessageId: 'ses-msg-2' });
      const content = Buffer.from('%PDF-1.4 real cv bytes');

      const result = await adapter.send({
        ...REQUEST,
        attachments: [{ fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: content.length, contentReference: 'doc-1' }],
        resolvedAttachments: [{ fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: content.length, content }],
      });

      expect(result.accepted).toBe(true);
      const sentCommand = mockSend.mock.calls[0][0] as { input: { RawMessage: { Data: Buffer } } };
      const rawMessage = sentCommand.input.RawMessage.Data.toString('utf8');
      expect(rawMessage).toContain('Content-Disposition: attachment; filename="cv.pdf"');
      expect(rawMessage).toContain(content.toString('base64').slice(0, 20));
    });

    it('rejects an attachment set that would exceed SES\'s documented 10MB raw-message size limit after base64 encoding', async () => {
      const adapter = new SesEmailProviderAdapter(fakeConfig(), clock);
      const oversized = Buffer.alloc(9 * 1024 * 1024, 'a'); // 9MB raw -> ~12MB base64, exceeding SES's 10MB limit

      const result = await adapter.send({
        ...REQUEST,
        attachments: [{ fileName: 'huge.pdf', mimeType: 'application/pdf', sizeBytes: oversized.length, contentReference: 'doc-1' }],
        resolvedAttachments: [{ fileName: 'huge.pdf', mimeType: 'application/pdf', sizeBytes: oversized.length, content: oversized }],
      });

      expect(result.failure).toMatchObject({ category: 'PROVIDER_UNAVAILABLE', retryable: true });
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
