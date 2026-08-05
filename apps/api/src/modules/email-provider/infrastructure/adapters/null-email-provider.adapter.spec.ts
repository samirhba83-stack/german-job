import { NullEmailProvider } from './null-email-provider.adapter';
import { FixedClock } from '../../../execution/infrastructure/clock/fixed-clock';
import { EmailDeliveryRequest } from '../../domain/models/email-delivery-request';

const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildRequest(overrides: Partial<EmailDeliveryRequest> = {}): EmailDeliveryRequest {
  return {
    requestId: 'req-1',
    sender: { displayName: 'Jane Doe', emailAddress: 'jane@example.com' },
    recipientEmailAddress: 'hr@company.example',
    subject: 'Application',
    plainTextBody: 'Hello.',
    htmlBody: null,
    attachments: [],
    ...overrides,
  };
}

describe('NullEmailProvider', () => {
  it('identifies itself with a stable, non-provider-specific id', () => {
    const provider = new NullEmailProvider(new FixedClock(NOW));
    expect(provider.providerId).toBe('null-provider');
  });

  describe('capability model', () => {
    it('declares a complete, honest capability set with nothing configured', () => {
      const provider = new NullEmailProvider(new FixedClock(NOW));

      const capabilities = provider.getCapabilities();

      expect(capabilities).toEqual({
        providerId: 'null-provider',
        supportsAttachments: false,
        supportsHtml: false,
        supportsPlainText: true,
        maxAttachmentSizeBytes: null,
        maxRecipientsPerRequest: 1,
        dailyDeliveryLimit: 0,
        requiresAuthentication: false,
        supportedAuthenticationMethods: [],
      });
    });
  });

  describe('availability', () => {
    it('honestly reports unavailable, since no real provider is configured', async () => {
      const provider = new NullEmailProvider(new FixedClock(NOW));
      await expect(provider.isAvailable()).resolves.toBe(false);
    });
  });

  describe('send (response model)', () => {
    it('returns an explainable, non-accepted response for every request', async () => {
      const provider = new NullEmailProvider(new FixedClock(NOW));

      const response = await provider.send(buildRequest({ requestId: 'req-42' }));

      expect(response.providerId).toBe('null-provider');
      expect(response.status).toBe('UNSUPPORTED');
      expect(response.accepted).toBe(false);
      expect(response.executedAt).toEqual(NOW);
      expect(response.providerMessage).toContain('req-42');
      expect(response.providerMetadata).toEqual({});
      expect(response.failure).toEqual({
        category: 'PROVIDER_UNAVAILABLE',
        message: expect.any(String),
        retryable: false,
      });
    });

    it('is deterministic for the same clock reading', async () => {
      const clock = new FixedClock(NOW);
      const provider = new NullEmailProvider(clock);

      const first = await provider.send(buildRequest());
      const second = await provider.send(buildRequest());

      expect(first).toEqual(second);
    });

    it('reads its timestamp from the injected clock, not the real wall clock', async () => {
      const clock = new FixedClock(NOW);
      const provider = new NullEmailProvider(clock);
      clock.advance(5000);

      const response = await provider.send(buildRequest());

      expect(response.executedAt).toEqual(new Date(NOW.getTime() + 5000));
    });
  });
});
