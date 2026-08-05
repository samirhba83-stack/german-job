import { ConfigService } from '@nestjs/config';
import { ExecutionClock } from '../../../execution/domain/ports/execution-clock.port';
import { EmailDeliveryRequest } from '../../domain/models/email-delivery-request';

const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({ sendMail: mockSendMail })),
}));

import { SmtpEmailProviderAdapter } from './smtp-email-provider.adapter';

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

function fakeConfig(host = 'smtp.example.com'): ConfigService {
  const values: Record<string, unknown> = {
    'emailInfrastructure.smtp.host': host,
    'emailInfrastructure.smtp.port': 587,
    'emailInfrastructure.smtp.secure': false,
    'emailInfrastructure.smtp.user': 'user',
    'emailInfrastructure.smtp.password': 'pass',
  };
  return { get: (key: string, defaultValue?: unknown) => values[key] ?? defaultValue } as unknown as ConfigService;
}

const clock: ExecutionClock = { now: () => NOW };

describe('SmtpEmailProviderAdapter', () => {
  beforeEach(() => {
    mockSendMail.mockReset();
  });

  it('honestly reports no attachment support and BASIC auth', () => {
    const adapter = new SmtpEmailProviderAdapter(fakeConfig(), clock);
    expect(adapter.getCapabilities()).toMatchObject({ providerId: 'smtp', supportsAttachments: true, supportedAuthenticationMethods: ['BASIC'] });
  });

  it('isAvailable is false without a configured host', async () => {
    const adapter = new SmtpEmailProviderAdapter(fakeConfig(''), clock);
    await expect(adapter.isAvailable()).resolves.toBe(false);
  });

  it('accepts a successful send and surfaces the SMTP message id', async () => {
    const adapter = new SmtpEmailProviderAdapter(fakeConfig(), clock);
    mockSendMail.mockResolvedValueOnce({ messageId: '<abc@smtp>', response: '250 OK' });

    const result = await adapter.send(REQUEST);

    expect(result.accepted).toBe(true);
    expect(result.providerMetadata.providerMessageId).toBe('<abc@smtp>');
  });

  it('maps a 5xx SMTP response code to INVALID_RECIPIENT, non-retryable', async () => {
    const adapter = new SmtpEmailProviderAdapter(fakeConfig(), clock);
    const error = Object.assign(new Error('mailbox unavailable'), { responseCode: 550 });
    mockSendMail.mockRejectedValueOnce(error);

    const result = await adapter.send(REQUEST);
    expect(result.failure).toMatchObject({ category: 'INVALID_RECIPIENT', retryable: false });
  });

  it('maps a 4xx SMTP response code to RATE_LIMITED, retryable', async () => {
    const adapter = new SmtpEmailProviderAdapter(fakeConfig(), clock);
    const error = Object.assign(new Error('greylisted'), { responseCode: 421 });
    mockSendMail.mockRejectedValueOnce(error);

    const result = await adapter.send(REQUEST);
    expect(result.failure).toMatchObject({ category: 'RATE_LIMITED', retryable: true });
  });

  it('maps an EAUTH error code to AUTHENTICATION, non-retryable', async () => {
    const adapter = new SmtpEmailProviderAdapter(fakeConfig(), clock);
    const error = Object.assign(new Error('bad credentials'), { code: 'EAUTH' });
    mockSendMail.mockRejectedValueOnce(error);

    const result = await adapter.send(REQUEST);
    expect(result.failure).toMatchObject({ category: 'AUTHENTICATION', retryable: false });
  });

  it('maps an unrecognized transport error to PROVIDER_UNAVAILABLE, retryable', async () => {
    const adapter = new SmtpEmailProviderAdapter(fakeConfig(), clock);
    mockSendMail.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await adapter.send(REQUEST);
    expect(result.failure).toMatchObject({ category: 'PROVIDER_UNAVAILABLE', retryable: true });
  });

  it('refuses to send without a configured host, without ever calling sendMail', async () => {
    const adapter = new SmtpEmailProviderAdapter(fakeConfig(''), clock);
    const result = await adapter.send(REQUEST);
    expect(result.failure?.category).toBe('AUTHENTICATION');
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('rejects a body-less request as UNSUPPORTED_CAPABILITY', async () => {
    const adapter = new SmtpEmailProviderAdapter(fakeConfig(), clock);
    const result = await adapter.send({ ...REQUEST, plainTextBody: null, htmlBody: null });
    expect(result.failure?.category).toBe('UNSUPPORTED_CAPABILITY');
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  describe('M28.5 real attachment support (native Nodemailer attachments)', () => {
    it('refuses to send when attachments are declared but none were resolved to real bytes', async () => {
      const adapter = new SmtpEmailProviderAdapter(fakeConfig(), clock);
      const result = await adapter.send({ ...REQUEST, attachments: [{ fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 3, contentReference: 'doc-1' }] });
      expect(result.failure?.category).toBe('UNSUPPORTED_CAPABILITY');
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('passes the real resolved Buffer directly to Nodemailer\'s attachments option', async () => {
      const adapter = new SmtpEmailProviderAdapter(fakeConfig(), clock);
      mockSendMail.mockResolvedValueOnce({ messageId: '<cv@smtp>', response: '250 OK' });
      const content = Buffer.from('%PDF-1.4 real cv bytes');

      await adapter.send({
        ...REQUEST,
        attachments: [{ fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: content.length, contentReference: 'doc-1' }],
        resolvedAttachments: [{ fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: content.length, content }],
      });

      const sentMail = mockSendMail.mock.calls[0][0];
      expect(sentMail.attachments).toEqual([{ filename: 'cv.pdf', content, contentType: 'application/pdf' }]);
    });

    it('sets replyTo when the sender identity carries one', async () => {
      const adapter = new SmtpEmailProviderAdapter(fakeConfig(), clock);
      mockSendMail.mockResolvedValueOnce({ messageId: '<x@smtp>', response: '250 OK' });

      await adapter.send({ ...REQUEST, sender: { ...REQUEST.sender, replyToEmailAddress: 'candidate@example.com' } });

      const sentMail = mockSendMail.mock.calls[0][0];
      expect(sentMail.replyTo).toBe('candidate@example.com');
    });
  });
});
