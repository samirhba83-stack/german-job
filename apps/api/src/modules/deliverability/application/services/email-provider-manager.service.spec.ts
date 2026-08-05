import { ConfigService } from '@nestjs/config';
import { EmailProviderManagerService } from './email-provider-manager.service';
import { EmailProviderPort } from '../../../email-provider/domain/ports/email-provider.port';
import { EmailDeliveryRequest } from '../../../email-provider/domain/models/email-delivery-request';
import { EmailDeliveryResponse } from '../../../email-provider/domain/models/email-delivery-response';
import { ProviderCapabilities } from '../../../email-provider/domain/models/provider-capabilities';
import { ProviderSelectionEnginePort } from '../../../provider-selection/domain/ports/provider-selection-engine.port';
import { ProviderSelectionCriteria } from '../../../provider-selection/domain/models/provider-selection-criteria';
import { ProviderEvaluation } from '../../../provider-selection/domain/models/provider-evaluation';
import { EmailProviderHealthRepository, EmailProviderHealthSnapshot } from '../../domain/ports/email-provider-health.repository';
import { ExecutionClock } from '../../../execution/domain/ports/execution-clock.port';
import { AttachmentResolverPort } from '../../../documents/domain/ports/attachment-resolver.port';
import { DomainReadinessService } from './domain-readiness.service';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';

const NOW = new Date('2026-08-01T12:00:00.000Z');

function capabilities(providerId: string): ProviderCapabilities {
  return {
    providerId,
    supportsAttachments: false,
    supportsHtml: true,
    supportsPlainText: true,
    maxAttachmentSizeBytes: null,
    maxRecipientsPerRequest: 1,
    dailyDeliveryLimit: null,
    requiresAuthentication: true,
    supportedAuthenticationMethods: ['API_KEY'],
  };
}

function evaluation(providerId: string, priorityScore: number): ProviderEvaluation {
  return { providerId, eligible: true, capabilities: capabilities(providerId), priorityScore, explanation: 'eligible' };
}

function fakeProvider(providerId: string, impl: (req: EmailDeliveryRequest) => Promise<EmailDeliveryResponse>): EmailProviderPort {
  return {
    providerId,
    getCapabilities: () => capabilities(providerId),
    isAvailable: async () => true,
    send: jest.fn(impl),
  } as unknown as EmailProviderPort;
}

function acceptedResponse(providerId: string): EmailDeliveryResponse {
  return {
    providerId,
    status: 'ACCEPTED',
    accepted: true,
    executedAt: NOW,
    providerMessage: 'ok',
    providerMetadata: { providerMessageId: `${providerId}-msg-1` },
    failure: null,
  };
}

function failedResponse(providerId: string, category: EmailDeliveryResponse['failure'] extends null ? never : NonNullable<EmailDeliveryResponse['failure']>['category']): EmailDeliveryResponse {
  return {
    providerId,
    status: 'FAILED',
    accepted: false,
    executedAt: NOW,
    providerMessage: 'nope',
    providerMetadata: {},
    failure: { category, message: 'nope', retryable: true },
  };
}

const REQUEST: EmailDeliveryRequest = {
  requestId: 'req-1',
  sender: { displayName: 'German Job Engine', emailAddress: 'noreply@example.com' },
  recipientEmailAddress: 'recruiter@example.de',
  subject: 'Application',
  plainTextBody: 'Hello',
  htmlBody: null,
  attachments: [],
};

const CRITERIA: ProviderSelectionCriteria = {
  requiresAttachments: false,
  requiresHtml: false,
  requiresPlainText: true,
  recipientCount: 1,
  correlationId: null,
  traceId: null,
};

function harness(providers: EmailProviderPort[], evaluations: ProviderEvaluation[], healthByProvider: Record<string, EmailProviderHealthSnapshot | null> = {}) {
  const selectionEngine: ProviderSelectionEnginePort = {
    selectProvider: jest.fn().mockResolvedValue({
      provider: null,
      decision: { selectedProviderId: evaluations[0]?.providerId ?? null, selectionReason: 'ranked', evaluatedAt: NOW, evaluations, rejectedProviders: [] },
    }),
  };
  const recordSuccess = jest.fn().mockResolvedValue(undefined);
  const recordFailure = jest.fn().mockResolvedValue(undefined);
  const health: EmailProviderHealthRepository = {
    get: jest.fn(async (providerId: string) => healthByProvider[providerId] ?? null),
    getAll: jest.fn(async () => []),
    recordSuccess,
    recordFailure,
    forceOpen: jest.fn(),
    forceClose: jest.fn(),
  };
  const clock: ExecutionClock = { now: () => NOW };
  const config = {
    get: (key: string, defaultValue?: unknown) => {
      const values: Record<string, unknown> = {
        'emailInfrastructure.providerManager.circuitBreakerThreshold': 5,
        'emailInfrastructure.providerManager.circuitBreakerCooldownMs': 300_000,
        'emailInfrastructure.providerManager.sendTimeoutMs': 50,
      };
      return values[key] ?? defaultValue;
    },
  } as unknown as ConfigService;

  // None of this file's tests use requests with attachments, so the M28.5 attachment-resolution/
  // domain-readiness gate never triggers — these fakes exist only to satisfy the constructor and
  // are asserted never to be called. Dedicated coverage for the gate itself lives in this same
  // spec file's "attachment resolution gate" describe block below.
  const attachmentResolver: AttachmentResolverPort = { resolve: jest.fn() };
  const domainReadiness = { checkReadiness: jest.fn() } as unknown as DomainReadinessService;
  const securityAudit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as EmailSecurityAuditService;

  const service = new EmailProviderManagerService(providers, selectionEngine, health, clock, attachmentResolver, domainReadiness, securityAudit, config);
  return { service, selectionEngine, health, recordSuccess, recordFailure, attachmentResolver, domainReadiness, securityAudit };
}

describe('EmailProviderManagerService', () => {
  it('sends via the top-ranked eligible provider on the first try', async () => {
    const resend = fakeProvider('resend', async () => acceptedResponse('resend'));
    const ses = fakeProvider('ses', async () => acceptedResponse('ses'));
    const { service, recordSuccess } = harness([resend, ses], [evaluation('resend', 100), evaluation('ses', 50)]);

    const result = await service.sendWithFailover(REQUEST, CRITERIA);

    expect(result.response.accepted).toBe(true);
    expect(result.response.providerId).toBe('resend');
    expect(result.attempts).toHaveLength(1);
    expect(recordSuccess).toHaveBeenCalledWith('resend', NOW);
    expect(ses.send).not.toHaveBeenCalled();
  });

  it('fails over to the next ranked provider on a retryable failure category', async () => {
    const resend = fakeProvider('resend', async () => failedResponse('resend', 'PROVIDER_UNAVAILABLE'));
    const ses = fakeProvider('ses', async () => acceptedResponse('ses'));
    const { service, recordFailure, recordSuccess } = harness([resend, ses], [evaluation('resend', 100), evaluation('ses', 50)]);

    const result = await service.sendWithFailover(REQUEST, CRITERIA);

    expect(result.response.accepted).toBe(true);
    expect(result.response.providerId).toBe('ses');
    expect(result.attempts).toHaveLength(2);
    expect(recordFailure).toHaveBeenCalledWith('resend', NOW, 5, 300_000);
    expect(recordSuccess).toHaveBeenCalledWith('ses', NOW);
  });

  it('does not fail over on a non-failover category (INVALID_RECIPIENT) — stops immediately', async () => {
    const resend = fakeProvider('resend', async () => failedResponse('resend', 'INVALID_RECIPIENT'));
    const ses = fakeProvider('ses', async () => acceptedResponse('ses'));
    const { service } = harness([resend, ses], [evaluation('resend', 100), evaluation('ses', 50)]);

    const result = await service.sendWithFailover(REQUEST, CRITERIA);

    expect(result.response.accepted).toBe(false);
    expect(result.response.providerId).toBe('resend');
    expect(result.attempts).toHaveLength(1);
    expect(ses.send).not.toHaveBeenCalled();
  });

  it('skips a provider whose circuit breaker is open, without calling send()', async () => {
    const resend = fakeProvider('resend', async () => acceptedResponse('resend'));
    const ses = fakeProvider('ses', async () => acceptedResponse('ses'));
    const openHealth: EmailProviderHealthSnapshot = {
      providerId: 'resend',
      consecutiveFailures: 5,
      lastFailureAt: NOW,
      lastSuccessAt: null,
      circuitOpenUntil: new Date(NOW.getTime() + 60_000),
    };
    const { service } = harness([resend, ses], [evaluation('resend', 100), evaluation('ses', 50)], { resend: openHealth });

    const result = await service.sendWithFailover(REQUEST, CRITERIA);

    expect(resend.send).not.toHaveBeenCalled();
    expect(result.response.providerId).toBe('ses');
    expect(result.response.accepted).toBe(true);
    expect(result.attempts[0]).toMatchObject({ providerId: 'resend', skippedCircuitOpen: true });
  });

  it('treats a provider that never resolves as a timeout failure and fails over', async () => {
    const resend = fakeProvider('resend', () => new Promise<EmailDeliveryResponse>(() => {}));
    const ses = fakeProvider('ses', async () => acceptedResponse('ses'));
    const { service, recordFailure } = harness([resend, ses], [evaluation('resend', 100), evaluation('ses', 50)]);

    const result = await service.sendWithFailover(REQUEST, CRITERIA);

    expect(result.response.providerId).toBe('ses');
    expect(result.response.accepted).toBe(true);
    expect(recordFailure).toHaveBeenCalledWith('resend', NOW, 5, 300_000);
  }, 10_000);

  it('returns a synthesized no-provider response when nothing is eligible', async () => {
    const { service } = harness([], []);

    const result = await service.sendWithFailover(REQUEST, CRITERIA);

    expect(result.response.accepted).toBe(false);
    expect(result.response.providerId).toBe('none');
    expect(result.attempts).toHaveLength(0);
  });

  it('returns the last attempted failure when every eligible provider fails', async () => {
    const resend = fakeProvider('resend', async () => failedResponse('resend', 'PROVIDER_UNAVAILABLE'));
    const ses = fakeProvider('ses', async () => failedResponse('ses', 'RATE_LIMITED'));
    const { service } = harness([resend, ses], [evaluation('resend', 100), evaluation('ses', 50)]);

    const result = await service.sendWithFailover(REQUEST, CRITERIA);

    expect(result.response.accepted).toBe(false);
    expect(result.response.providerId).toBe('ses');
    expect(result.attempts).toHaveLength(2);
  });

  describe('M28.5 attachment resolution / domain readiness gate', () => {
    const REQUEST_WITH_ATTACHMENTS: EmailDeliveryRequest = {
      ...REQUEST,
      attachments: [{ fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 10, contentReference: 'doc-1' }],
      requestingUserId: 'user-1',
      applicationContextId: 'app-1',
    };

    it('blocks the send entirely — no provider ever contacted — when the domain readiness gate fails', async () => {
      const resend = fakeProvider('resend', async () => acceptedResponse('resend'));
      const { service, domainReadiness } = harness([resend], [evaluation('resend', 100)]);
      (domainReadiness.checkReadiness as jest.Mock).mockResolvedValue({ ready: false, senderIdentity: null, blockingReasons: ['Production email sending is not enabled.'] });

      const result = await service.sendWithFailover(REQUEST_WITH_ATTACHMENTS, CRITERIA);

      expect(resend.send).not.toHaveBeenCalled();
      expect(result.attempts).toHaveLength(0);
      expect(result.response.accepted).toBe(false);
      expect(result.response.providerId).toBe('attachment-gate');
      expect(result.response.providerMessage).toContain('Production email sending is not enabled');
    });

    it('blocks the send entirely when the one authoritative attachment resolver reports a failure', async () => {
      const resend = fakeProvider('resend', async () => acceptedResponse('resend'));
      const { service, domainReadiness, attachmentResolver } = harness([resend], [evaluation('resend', 100)]);
      (domainReadiness.checkReadiness as jest.Mock).mockResolvedValue({ ready: true, senderIdentity: null, blockingReasons: [] });
      (attachmentResolver.resolve as jest.Mock).mockResolvedValue({ resolved: [], failure: { reason: 'OWNERSHIP_MISMATCH', documentId: 'doc-1', detail: 'Document "doc-1" is not owned by the requesting user.' } });

      const result = await service.sendWithFailover(REQUEST_WITH_ATTACHMENTS, CRITERIA);

      expect(resend.send).not.toHaveBeenCalled();
      expect(result.response.accepted).toBe(false);
      expect(result.response.failure?.retryable).toBe(false);
      expect(result.response.providerMessage).toContain('not owned by the requesting user');
    });

    it('marks a transient resolution failure (e.g. storage unavailable) as retryable', async () => {
      const resend = fakeProvider('resend', async () => acceptedResponse('resend'));
      const { service, domainReadiness, attachmentResolver } = harness([resend], [evaluation('resend', 100)]);
      (domainReadiness.checkReadiness as jest.Mock).mockResolvedValue({ ready: true, senderIdentity: null, blockingReasons: [] });
      (attachmentResolver.resolve as jest.Mock).mockResolvedValue({ resolved: [], failure: { reason: 'STORAGE_UNAVAILABLE', documentId: 'doc-1', detail: 'Storage is temporarily unavailable.' } });

      const result = await service.sendWithFailover(REQUEST_WITH_ATTACHMENTS, CRITERIA);

      expect(result.response.failure?.retryable).toBe(true);
    });

    it('passes resolved attachment bytes to the provider, resolving exactly once even across failover to a second provider', async () => {
      const resolvedPayload = { documentId: 'doc-1', fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 2, checksumSha256: 'abc', content: Buffer.from('hi') };
      let capturedRequest: EmailDeliveryRequest | null = null;
      const resend = fakeProvider('resend', async () => failedResponse('resend', 'PROVIDER_UNAVAILABLE'));
      const ses = fakeProvider('ses', async (req) => {
        capturedRequest = req;
        return acceptedResponse('ses');
      });
      const { service, domainReadiness, attachmentResolver } = harness([resend, ses], [evaluation('resend', 100), evaluation('ses', 50)]);
      (domainReadiness.checkReadiness as jest.Mock).mockResolvedValue({ ready: true, senderIdentity: null, blockingReasons: [] });
      (attachmentResolver.resolve as jest.Mock).mockResolvedValue({ resolved: [resolvedPayload], failure: null });

      const result = await service.sendWithFailover(REQUEST_WITH_ATTACHMENTS, CRITERIA);

      expect(result.response.accepted).toBe(true);
      expect(attachmentResolver.resolve).toHaveBeenCalledTimes(1);
      expect(capturedRequest!.resolvedAttachments).toEqual([{ fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 2, content: Buffer.from('hi') }]);
    });

    it('records EMAIL_WITH_ATTACHMENTS_QUEUED and EMAIL_WITH_ATTACHMENTS_SENT security audit events on a successful attachment send', async () => {
      const resolvedPayload = { documentId: 'doc-1', fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 2, checksumSha256: 'abc', content: Buffer.from('hi') };
      const resend = fakeProvider('resend', async () => acceptedResponse('resend'));
      const { service, domainReadiness, attachmentResolver, securityAudit } = harness([resend], [evaluation('resend', 100)]);
      (domainReadiness.checkReadiness as jest.Mock).mockResolvedValue({ ready: true, senderIdentity: null, blockingReasons: [] });
      (attachmentResolver.resolve as jest.Mock).mockResolvedValue({ resolved: [resolvedPayload], failure: null });

      await service.sendWithFailover(REQUEST_WITH_ATTACHMENTS, CRITERIA);

      const eventTypes = (securityAudit.record as jest.Mock).mock.calls.map((call) => call[0].eventType);
      expect(eventTypes).toContain('EMAIL_WITH_ATTACHMENTS_QUEUED');
      expect(eventTypes).toContain('EMAIL_WITH_ATTACHMENTS_SENT');
    });

    it('never invokes the attachment resolver or domain readiness gate for a request with no attachments', async () => {
      const resend = fakeProvider('resend', async () => acceptedResponse('resend'));
      const { service, domainReadiness, attachmentResolver } = harness([resend], [evaluation('resend', 100)]);

      await service.sendWithFailover(REQUEST, CRITERIA);

      expect(domainReadiness.checkReadiness).not.toHaveBeenCalled();
      expect(attachmentResolver.resolve).not.toHaveBeenCalled();
    });
  });
});
