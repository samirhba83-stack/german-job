import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectedMailboxRepository, CONNECTED_MAILBOX_REPOSITORY } from '../../domain/ports/connected-mailbox.repository';
import { ConnectedMailboxRecord } from '../../domain/models/connected-mailbox';
import { validateGrantedScopes } from '../../domain/services/oauth-scope-policy';
import { DeliverabilityService } from '../../../deliverability/application/services/deliverability.service';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { ConnectedMailboxRateLimiterService } from './connected-mailbox-rate-limiter.service';

export interface MailboxReadinessCheckInput {
  readonly userId: string;
  readonly recipientEmailAddress: string;
}

export interface ConnectedMailboxReadinessResult {
  readonly ready: boolean;
  readonly mailbox: ConnectedMailboxRecord | null;
  readonly blockingReasons: ReadonlyArray<string>;
}

/**
 * M28.6 Phase 8 — the ONE authoritative gate every candidate application send must pass before a
 * connected-mailbox provider adapter is ever called. Accumulates every blocking reason rather than
 * short-circuiting on the first (matching M28.5's `DomainReadinessService` precedent) — a caller
 * that fails five checks should see all five, not just the first alphabetically-checked one.
 *
 * Deliberately NOT checked here (by design, not oversight):
 * - "Sender email matches the verified mailbox" — satisfied by construction, since
 *   `ConnectedMailboxSendService` always builds the From address FROM this exact mailbox record;
 *   there is no code path where a caller can specify a different sender.
 * - "Campaign safety rules permit sending" — already enforced upstream by
 *   `BusinessPolicyEnforcementService`/`Campaign.planNextBatch()` before this gate is ever
 *   reached; duplicating it here would be a second, driftable copy of the same rule.
 * - "Attachments passed M28.5 resolution" — attachment identity is per-application, not
 *   per-mailbox; resolved once at actual send time by `AttachmentResolverPort`, the same
 *   "resolve once, at send time" precedent `EmailProviderManagerService` already established.
 * - Live provider-side "does the account still match" verification — a real network call on
 *   every send would be slow and itself a new failure mode; this application trusts its own
 *   persisted `providerAccountId`/`emailAddress` (established once, from the provider itself, at
 *   connection time) the same way M28.5's `DomainReadinessService` trusts persisted, not
 *   live-reprobed, sender verification state.
 */
@Injectable()
export class ConnectedMailboxReadinessService {
  constructor(
    @Inject(CONNECTED_MAILBOX_REPOSITORY) private readonly mailboxes: ConnectedMailboxRepository,
    private readonly rateLimiter: ConnectedMailboxRateLimiterService,
    private readonly deliverability: DeliverabilityService,
    private readonly audit: EmailSecurityAuditService,
    private readonly config: ConfigService,
  ) {}

  async checkReadiness(input: MailboxReadinessCheckInput): Promise<ConnectedMailboxReadinessResult> {
    const reasons: string[] = [];

    const productionEnabled = this.config.get<boolean>('connectedMailbox.productionSendingEnabled', false);
    if (!productionEnabled) {
      reasons.push('Connected-mailbox production sending is not enabled.');
    }

    const suppressed = await this.deliverability.isSuppressed(input.recipientEmailAddress);
    if (suppressed) {
      reasons.push('Recipient is on the suppression list.');
    }

    const mailbox = await this.mailboxes.findActiveByUserId(input.userId);
    if (!mailbox) {
      reasons.push('No connected mailbox is set up for sending — connect Gmail or Outlook in Settings first.');
      await this.recordOutcome(null, input.userId, false, reasons);
      return { ready: false, mailbox: null, blockingReasons: reasons };
    }

    this.checkMailboxState(mailbox, reasons);

    if (reasons.length === 0) {
      const rateCheck = await this.rateLimiter.check(mailbox);
      if (!rateCheck.allowed) {
        reasons.push(rateCheck.detail ?? 'Sending rate limit reached for this mailbox.');
      }
    }

    const ready = reasons.length === 0;
    await this.recordOutcome(mailbox.id, input.userId, ready, reasons);
    return { ready, mailbox, blockingReasons: reasons };
  }

  private checkMailboxState(mailbox: ConnectedMailboxRecord, reasons: string[]): void {
    if (mailbox.status !== 'CONNECTED') {
      reasons.push(`Connected mailbox status is "${mailbox.status}", not CONNECTED.`);
    }
    if (mailbox.userDisabled) {
      reasons.push('This mailbox was disconnected — reconnect it in Settings to resume sending.');
    }
    if (mailbox.systemSuspended) {
      reasons.push(`This mailbox is suspended for safety review: ${mailbox.suspensionReason ?? 'no reason recorded'}.`);
    }
    if (mailbox.reauthorizationRequired) {
      reasons.push('This mailbox requires reauthorization — reconnect it in Settings.');
    }
    if (!mailbox.hasRefreshToken) {
      reasons.push('This mailbox has no valid refresh token on file — reconnect it in Settings.');
    }

    const scopeCheck = validateGrantedScopes(mailbox.provider, mailbox.grantedScopes);
    if (!scopeCheck.accepted) {
      reasons.push('This mailbox is missing a required permission — reconnect it in Settings.');
    }
  }

  private async recordOutcome(connectedMailboxId: string | null, userId: string, ready: boolean, reasons: ReadonlyArray<string>): Promise<void> {
    await this.audit.record({
      eventType: ready ? 'CONNECTED_SEND_RESERVED' : 'CONNECTED_SEND_BLOCKED',
      connectedMailboxId,
      userId,
      detail: ready ? 'Readiness gate passed.' : reasons.join(' '),
    });
  }
}
