import { ConfigService } from '@nestjs/config';
import { DomainReadinessService } from './domain-readiness.service';
import { SenderIdentityRepository } from '../../domain/ports/sender-identity.repository';
import { SenderIdentityRecord } from '../../domain/models/sender-identity';
import { EmailProviderPort } from '../../../email-provider/domain/ports/email-provider.port';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';

const NOW = new Date('2026-08-01T12:00:00.000Z');

function senderIdentity(overrides: Partial<SenderIdentityRecord> = {}): SenderIdentityRecord {
  return {
    id: 'sender-1',
    displayName: 'German Job Engine',
    emailAddress: 'applications@germanjobengine.example',
    domain: 'germanjobengine.example',
    providerId: 'resend',
    providerIdentityRef: null,
    verificationStatus: 'VERIFIED',
    dkimVerified: true,
    spfReady: true,
    dmarcReady: true,
    replyToEmailAddress: null,
    allowedRegions: [],
    isActive: true,
    failureReason: null,
    verifiedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const DEFAULT_CONFIG_VALUES: Record<string, unknown> = {
  'emailInfrastructure.primaryProvider': 'resend',
  'attachmentSecurity.platformSender.emailAddress': 'applications@germanjobengine.example',
  'attachmentSecurity.platformSender.domain': 'germanjobengine.example',
  'attachmentSecurity.attachmentsProductionEnabled': true,
  'attachmentSecurity.senderIdentityEnforcementEnabled': true,
  'emailInfrastructure.productionSendingEnabled': true,
};

function harness(configOverrides: Record<string, unknown> = {}, identity: SenderIdentityRecord | null = senderIdentity(), providerAvailable = true) {
  const senderIdentities: jest.Mocked<SenderIdentityRepository> = {
    findById: jest.fn(),
    findByEmailAndProvider: jest.fn().mockResolvedValue(identity),
    listAll: jest.fn(),
    create: jest.fn(),
    updateVerification: jest.fn(),
    setActive: jest.fn(),
  };
  const provider: EmailProviderPort = { providerId: 'resend', getCapabilities: jest.fn(), isAvailable: jest.fn().mockResolvedValue(providerAvailable), send: jest.fn() } as unknown as EmailProviderPort;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<EmailSecurityAuditService>;
  const config = {
    get: (key: string, defaultValue?: unknown) => {
      const values = { ...DEFAULT_CONFIG_VALUES, ...configOverrides };
      return values[key] ?? defaultValue;
    },
  } as unknown as ConfigService;

  const service = new DomainReadinessService(senderIdentities, [provider], audit, config);
  return { service, senderIdentities, audit };
}

describe('DomainReadinessService', () => {
  it('passes when every condition is satisfied', async () => {
    const { service } = harness();
    const result = await service.checkReadiness();
    expect(result.ready).toBe(true);
    expect(result.blockingReasons).toHaveLength(0);
  });

  it('fails closed when production email sending is not enabled (default)', async () => {
    const { service } = harness({ 'emailInfrastructure.productionSendingEnabled': false });
    const result = await service.checkReadiness();
    expect(result.ready).toBe(false);
    expect(result.blockingReasons.some((r) => r.includes('Production email sending'))).toBe(true);
  });

  it('fails closed when attachment production delivery is not enabled (default)', async () => {
    const { service } = harness({ 'attachmentSecurity.attachmentsProductionEnabled': false });
    const result = await service.checkReadiness();
    expect(result.ready).toBe(false);
    expect(result.blockingReasons.some((r) => r.includes('attachment delivery'))).toBe(true);
  });

  it('fails closed when no platform sender email/domain is configured', async () => {
    const { service } = harness({ 'attachmentSecurity.platformSender.emailAddress': '', 'attachmentSecurity.platformSender.domain': '' });
    const result = await service.checkReadiness();
    expect(result.ready).toBe(false);
  });

  it('fails when sender-identity enforcement is on but no identity is registered', async () => {
    const { service } = harness({}, null);
    const result = await service.checkReadiness();
    expect(result.ready).toBe(false);
    expect(result.blockingReasons.some((r) => r.includes('No sender identity is registered'))).toBe(true);
  });

  it('skips sender-identity-specific checks entirely when enforcement is disabled, even with no identity registered', async () => {
    const { service } = harness({ 'attachmentSecurity.senderIdentityEnforcementEnabled': false }, null);
    const result = await service.checkReadiness();
    expect(result.ready).toBe(true);
  });

  it('fails when the sender identity is inactive', async () => {
    const { service } = harness({}, senderIdentity({ isActive: false }));
    const result = await service.checkReadiness();
    expect(result.ready).toBe(false);
    expect(result.blockingReasons.some((r) => r.includes('not active'))).toBe(true);
  });

  it('fails when the sender identity domain does not match the configured platform domain', async () => {
    const { service } = harness({}, senderIdentity({ domain: 'wrong-domain.example' }));
    const result = await service.checkReadiness();
    expect(result.ready).toBe(false);
  });

  it('fails when the sender identity is not VERIFIED', async () => {
    const { service } = harness({}, senderIdentity({ verificationStatus: 'PENDING' }));
    const result = await service.checkReadiness();
    expect(result.ready).toBe(false);
    expect(result.blockingReasons.some((r) => r.includes('PENDING'))).toBe(true);
  });

  it('fails when DKIM is not verified', async () => {
    const { service } = harness({}, senderIdentity({ dkimVerified: false }));
    const result = await service.checkReadiness();
    expect(result.ready).toBe(false);
    expect(result.blockingReasons.some((r) => r.includes('DKIM'))).toBe(true);
  });

  it('fails when SPF is not ready', async () => {
    const { service } = harness({}, senderIdentity({ spfReady: false }));
    const result = await service.checkReadiness();
    expect(result.ready).toBe(false);
    expect(result.blockingReasons.some((r) => r.includes('SPF'))).toBe(true);
  });

  it('fails when DMARC is not ready', async () => {
    const { service } = harness({}, senderIdentity({ dmarcReady: false }));
    const result = await service.checkReadiness();
    expect(result.ready).toBe(false);
    expect(result.blockingReasons.some((r) => r.includes('DMARC'))).toBe(true);
  });

  it('fails when the reply-to address is malformed', async () => {
    const { service } = harness({}, senderIdentity({ replyToEmailAddress: 'not-an-email' }));
    const result = await service.checkReadiness();
    expect(result.ready).toBe(false);
    expect(result.blockingReasons.some((r) => r.includes('Reply-to'))).toBe(true);
  });

  it('accepts a valid reply-to address', async () => {
    const { service } = harness({}, senderIdentity({ replyToEmailAddress: 'candidate@example.com' }));
    const result = await service.checkReadiness();
    expect(result.ready).toBe(true);
  });

  it('fails when the primary provider adapter is unavailable (missing credentials)', async () => {
    const { service } = harness({}, senderIdentity(), false);
    const result = await service.checkReadiness();
    expect(result.ready).toBe(false);
    expect(result.blockingReasons.some((r) => r.includes('unavailable'))).toBe(true);
  });

  it('fails when no adapter is registered for the configured primary provider', async () => {
    const { service } = harness({ 'emailInfrastructure.primaryProvider': 'sendgrid' });
    const result = await service.checkReadiness();
    expect(result.ready).toBe(false);
    expect(result.blockingReasons.some((r) => r.includes('No provider adapter'))).toBe(true);
  });

  it('records DOMAIN_READINESS_PASSED on success and DOMAIN_READINESS_FAILED on failure', async () => {
    const passing = harness();
    await passing.service.checkReadiness();
    expect((passing.audit.record as jest.Mock).mock.calls[0][0].eventType).toBe('DOMAIN_READINESS_PASSED');

    const failing = harness({ 'emailInfrastructure.productionSendingEnabled': false });
    await failing.service.checkReadiness();
    expect((failing.audit.record as jest.Mock).mock.calls[0][0].eventType).toBe('DOMAIN_READINESS_FAILED');
  });
});
