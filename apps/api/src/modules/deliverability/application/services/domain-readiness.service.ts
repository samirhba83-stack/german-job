import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProviderPort } from '../../../email-provider/domain/ports/email-provider.port';
import { EMAIL_PROVIDERS } from '../../../provider-selection/domain/ports/email-provider-registry.token';
import { SenderIdentityRepository, SENDER_IDENTITY_REPOSITORY } from '../../domain/ports/sender-identity.repository';
import { SenderIdentityRecord } from '../../domain/models/sender-identity';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface DomainReadinessResult {
  readonly ready: boolean;
  readonly senderIdentity: SenderIdentityRecord | null;
  readonly blockingReasons: ReadonlyArray<string>;
}

/**
 * M28.5 Phase 10 — the ONE centralized gate real external delivery with attachments must pass.
 * Deliberately conservative: every check defaults to blocking (fail closed) unless the specific
 * condition it names is explicitly satisfied. Never performs a DNS lookup itself (Phase 10: "do
 * not perform fragile DNS assumptions from memory" — this application chooses not to hand-roll
 * DNS inspection at all, relying instead on a real provider API signal (SES) or explicit
 * admin-recorded confirmation for SPF/DKIM/DMARC readiness — see `SesDomainVerificationChecker`'s
 * own doc comment for exactly which signals are provider-verified vs. admin-attested).
 *
 * `EMAIL_SENDER_IDENTITY_ENFORCEMENT_ENABLED=false` (the default) intentionally skips the sender-
 * identity-specific checks below while still enforcing the two production kill switches — this is
 * what lets sandbox/staging keep working end to end before a real verified sender identity has
 * been registered at all.
 */
@Injectable()
export class DomainReadinessService {
  constructor(
    @Inject(SENDER_IDENTITY_REPOSITORY) private readonly senderIdentities: SenderIdentityRepository,
    @Inject(EMAIL_PROVIDERS) private readonly providers: EmailProviderPort[],
    private readonly audit: EmailSecurityAuditService,
    private readonly config: ConfigService,
  ) {}

  async checkReadiness(): Promise<DomainReadinessResult> {
    const reasons: string[] = [];
    const primaryProviderId = this.config.get<string>('emailInfrastructure.primaryProvider', 'null');
    const platformEmail = this.config.get<string>('attachmentSecurity.platformSender.emailAddress', '');
    const platformDomain = this.config.get<string>('attachmentSecurity.platformSender.domain', '');
    const attachmentsProductionEnabled = this.config.get<boolean>('attachmentSecurity.attachmentsProductionEnabled', false);
    const senderEnforcementEnabled = this.config.get<boolean>('attachmentSecurity.senderIdentityEnforcementEnabled', false);
    // Fulfills the brief's "EMAIL_PROVIDER_PRODUCTION_ENABLED" requirement via M28's own existing
    // master kill switch, rather than introducing a second, duplicate flag for the same real
    // capability — see the M28.5 report's Production Safety Gates section.
    const emailProductionEnabled = this.config.get<boolean>('emailInfrastructure.productionSendingEnabled', false);

    if (!emailProductionEnabled) reasons.push('Production email sending is not enabled.');
    if (!attachmentsProductionEnabled) reasons.push('Production attachment delivery is not enabled.');
    if (!platformEmail || !platformDomain) reasons.push('No platform sender email address or domain is configured.');

    let senderIdentity: SenderIdentityRecord | null = null;
    if (platformEmail && primaryProviderId !== 'null') {
      senderIdentity = await this.senderIdentities.findByEmailAndProvider(platformEmail, primaryProviderId);
    }

    if (senderEnforcementEnabled) {
      this.checkSenderIdentity(senderIdentity, platformDomain, reasons);
    }

    const provider = this.providers.find((p) => p.providerId === primaryProviderId);
    if (!provider) {
      reasons.push(`No provider adapter is registered for primary provider "${primaryProviderId}".`);
    } else if (!(await provider.isAvailable())) {
      reasons.push(`Primary provider "${primaryProviderId}" is not configured or unavailable.`);
    }

    const ready = reasons.length === 0;
    await this.audit.record({
      eventType: ready ? 'DOMAIN_READINESS_PASSED' : 'DOMAIN_READINESS_FAILED',
      senderIdentityId: senderIdentity?.id ?? null,
      detail: ready ? 'Domain readiness gate passed.' : reasons.join(' '),
    });

    return { ready, senderIdentity, blockingReasons: reasons };
  }

  private checkSenderIdentity(senderIdentity: SenderIdentityRecord | null, platformDomain: string, reasons: string[]): void {
    if (!senderIdentity) {
      reasons.push('No sender identity is registered for the configured platform sender and primary provider.');
      return;
    }
    if (!senderIdentity.isActive) reasons.push('Sender identity is not active.');
    if (senderIdentity.domain !== platformDomain) reasons.push('Sender identity domain does not match the configured platform domain.');
    if (senderIdentity.verificationStatus !== 'VERIFIED') reasons.push(`Sender identity verification status is "${senderIdentity.verificationStatus}", not VERIFIED.`);
    if (!senderIdentity.dkimVerified) reasons.push('DKIM is not verified for this sender identity.');
    if (!senderIdentity.spfReady) reasons.push('SPF is not confirmed ready for this sender identity.');
    if (!senderIdentity.dmarcReady) reasons.push('DMARC is not confirmed ready for this sender identity.');
    if (senderIdentity.replyToEmailAddress && !SIMPLE_EMAIL_PATTERN.test(senderIdentity.replyToEmailAddress)) {
      reasons.push('Reply-to address is not a valid email address.');
    }
  }
}
