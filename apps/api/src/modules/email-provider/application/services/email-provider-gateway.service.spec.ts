import { EmailProviderGatewayService } from './email-provider-gateway.service';
import { EmailProviderPort } from '../../domain/ports/email-provider.port';
import { EmailDeliveryRequest } from '../../domain/models/email-delivery-request';
import { EmailDeliveryResponse } from '../../domain/models/email-delivery-response';
import { ProviderCapabilities } from '../../domain/models/provider-capabilities';
import { NullEmailProvider } from '../../infrastructure/adapters/null-email-provider.adapter';
import { FixedClock } from '../../../execution/infrastructure/clock/fixed-clock';

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

/** A hypothetical SMTP-like adapter — a local test double standing in for a real future
 * implementation, used only to prove the gateway is genuinely provider-independent. */
class FakeSmtpLikeProvider implements EmailProviderPort {
  readonly providerId = 'fake-smtp';
  private available = true;

  setAvailable(value: boolean): void {
    this.available = value;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      providerId: this.providerId,
      supportsAttachments: true,
      supportsHtml: true,
      supportsPlainText: true,
      maxAttachmentSizeBytes: 10_000_000,
      maxRecipientsPerRequest: 1,
      dailyDeliveryLimit: 500,
      requiresAuthentication: true,
      supportedAuthenticationMethods: ['BASIC'],
    };
  }

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async send(request: EmailDeliveryRequest): Promise<EmailDeliveryResponse> {
    return {
      providerId: this.providerId,
      status: 'ACCEPTED',
      accepted: true,
      executedAt: NOW,
      providerMessage: `Accepted "${request.requestId}" for delivery over SMTP.`,
      providerMetadata: { smtpQueueId: 'q-1' },
      failure: null,
    };
  }
}

/** A second, differently-shaped hypothetical adapter — deliberately different capabilities and
 * auth model from FakeSmtpLikeProvider, to prove the gateway makes no assumption about either. */
class FakeGmailLikeProvider implements EmailProviderPort {
  readonly providerId = 'fake-gmail';

  getCapabilities(): ProviderCapabilities {
    return {
      providerId: this.providerId,
      supportsAttachments: true,
      supportsHtml: true,
      supportsPlainText: false,
      maxAttachmentSizeBytes: 25_000_000,
      maxRecipientsPerRequest: 100,
      dailyDeliveryLimit: null,
      requiresAuthentication: true,
      supportedAuthenticationMethods: ['OAUTH2'],
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async send(request: EmailDeliveryRequest): Promise<EmailDeliveryResponse> {
    return {
      providerId: this.providerId,
      status: 'ACCEPTED',
      accepted: true,
      executedAt: NOW,
      providerMessage: `Accepted "${request.requestId}" via the Gmail API.`,
      providerMetadata: { gmailMessageId: 'msg-abc' },
      failure: null,
    };
  }
}

describe('EmailProviderGatewayService', () => {
  describe('delegation (provider contract)', () => {
    it('delegates getProviderId, getCapabilities, checkAvailability, and send to the injected provider', async () => {
      const provider = new FakeSmtpLikeProvider();
      const gateway = new EmailProviderGatewayService(provider);

      expect(gateway.getProviderId()).toBe('fake-smtp');
      expect(gateway.getCapabilities()).toEqual(provider.getCapabilities());
      await expect(gateway.checkAvailability()).resolves.toBe(true);

      const response = await gateway.send(buildRequest());
      expect(response.providerId).toBe('fake-smtp');
    });
  });

  describe('provider independence / future adapter compatibility', () => {
    it('works identically against two differently-shaped hypothetical providers without any gateway change', async () => {
      const smtpGateway = new EmailProviderGatewayService(new FakeSmtpLikeProvider());
      const gmailGateway = new EmailProviderGatewayService(new FakeGmailLikeProvider());

      const smtpResponse = await smtpGateway.send(buildRequest({ requestId: 'req-smtp' }));
      const gmailResponse = await gmailGateway.send(buildRequest({ requestId: 'req-gmail' }));

      expect(smtpResponse.accepted).toBe(true);
      expect(gmailResponse.accepted).toBe(true);
      expect(smtpResponse.providerId).not.toBe(gmailResponse.providerId);
    });

    it('exposes each provider capability set unmodified, proving no capability assumption is baked in', () => {
      const smtpGateway = new EmailProviderGatewayService(new FakeSmtpLikeProvider());
      const gmailGateway = new EmailProviderGatewayService(new FakeGmailLikeProvider());

      expect(smtpGateway.getCapabilities().supportedAuthenticationMethods).toEqual(['BASIC']);
      expect(gmailGateway.getCapabilities().supportedAuthenticationMethods).toEqual(['OAUTH2']);
      expect(smtpGateway.getCapabilities().maxRecipientsPerRequest).toBe(1);
      expect(gmailGateway.getCapabilities().maxRecipientsPerRequest).toBe(100);
    });

    it('also works with the real default NullEmailProvider binding, unchanged', async () => {
      const gateway = new EmailProviderGatewayService(new NullEmailProvider(new FixedClock(NOW)));

      const response = await gateway.send(buildRequest());

      expect(gateway.getProviderId()).toBe('null-provider');
      expect(response.accepted).toBe(false);
    });
  });

  describe('explainability', () => {
    it('surfaces provider id, status, acceptance, timestamp, message, and metadata unmodified', async () => {
      const gateway = new EmailProviderGatewayService(new FakeGmailLikeProvider());

      const response = await gateway.send(buildRequest({ requestId: 'req-explain' }));

      expect(response.providerId).toBe('fake-gmail');
      expect(response.status).toBe('ACCEPTED');
      expect(response.accepted).toBe(true);
      expect(response.executedAt).toEqual(NOW);
      expect(response.providerMessage).toContain('req-explain');
      expect(response.providerMetadata).toEqual({ gmailMessageId: 'msg-abc' });
      expect(response.failure).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('propagates an unavailable provider truthfully', async () => {
      const provider = new FakeSmtpLikeProvider();
      provider.setAvailable(false);
      const gateway = new EmailProviderGatewayService(provider);

      await expect(gateway.checkAvailability()).resolves.toBe(false);
    });

    it('handles a request with attachments and HTML body without any gateway-level branching', async () => {
      const gateway = new EmailProviderGatewayService(new FakeGmailLikeProvider());
      const request = buildRequest({
        htmlBody: '<p>Hello</p>',
        attachments: [{ fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 1024, contentReference: 'doc-1' }],
      });

      const response = await gateway.send(request);

      expect(response.accepted).toBe(true);
    });
  });
});
