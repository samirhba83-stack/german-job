import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SenderIdentity } from '../../../email-provider/domain/models/sender-identity';

const FALLBACK_PLACEHOLDER_SENDER_EMAIL = 'no-reply@german-job-engine.internal';

/**
 * M28.5 Phase 11 — "Safe Sender Strategy": the ONE place a `SenderIdentity` is ever built for a
 * real candidate-facing send. From is always the platform's own configured, (eventually) verified
 * domain identity — never an arbitrary candidate's own email address, which this application
 * cannot verify and would be a real spoofing/deliverability risk if used as a From address. A
 * candidate's own real email address is instead carried as Reply-To, so a recipient's reply
 * reaches the candidate directly. Do not change this behavior (e.g. to allow a per-user From
 * address) without explicit product-owner approval, per the brief's own instruction.
 *
 * Falls back to the same placeholder address `CampaignBatchDispatchService` used before this
 * milestone when no real platform sender is configured yet (`EMAIL_SENDER_PLATFORM_EMAIL_ADDRESS`
 * unset) — preserves existing sandbox/dev behavior rather than sending with an empty From address.
 */
@Injectable()
export class PlatformSenderResolutionService {
  constructor(private readonly config: ConfigService) {}

  resolveForCandidate(candidateEmailAddress: string | null): SenderIdentity {
    const configuredEmail = this.config.get<string>('attachmentSecurity.platformSender.emailAddress', '');
    const displayName = this.config.get<string>('attachmentSecurity.platformSender.displayName', 'German Job Engine');
    return {
      displayName,
      emailAddress: configuredEmail || FALLBACK_PLACEHOLDER_SENDER_EMAIL,
      replyToEmailAddress: candidateEmailAddress,
    };
  }
}
