import { Inject, Injectable } from '@nestjs/common';
import { ConnectedMailboxRepository, CONNECTED_MAILBOX_REPOSITORY } from '../../../connected-mailbox/domain/ports/connected-mailbox.repository';
import { ConnectedMailboxProviderPort, CONNECTED_MAILBOX_PROVIDERS } from '../../../connected-mailbox/domain/ports/connected-mailbox-provider.port';
import { ConnectedMailboxRecord, ConnectedMailboxUpdatePatch } from '../../../connected-mailbox/domain/models/connected-mailbox';
import { MailboxTokenVaultService } from '../../../connected-mailbox/application/services/mailbox-token-vault.service';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';

class InboxAuthenticationError extends Error {}

/**
 * M29 — a small, dedicated access-token helper for inbox-reading operations (watch registration,
 * change polling, message fetches). Deliberately NOT a reuse of `ConnectedMailboxSendService`'s
 * private `getValidAccessToken()` (that method is send-path-internal and not exported) — but
 * reads/writes the exact same `ConnectedMailboxRepository` row and the exact same
 * `MailboxTokenVaultService`/`CONNECTED_MAILBOX_PROVIDERS` (send adapters, reused here only for
 * their shared `refreshAccessToken()` call — refreshing is capability-agnostic, since a mailbox
 * has exactly one refresh token covering the union of whatever scopes were granted). A refresh
 * failure here flips `inboxReauthorizationRequired` — never the send-capability's own
 * `reauthorizationRequired` flag, keeping the two capabilities' failure states independent.
 */
@Injectable()
export class InboxAccessTokenService {
  constructor(
    @Inject(CONNECTED_MAILBOX_REPOSITORY) private readonly mailboxes: ConnectedMailboxRepository,
    @Inject(CONNECTED_MAILBOX_PROVIDERS) private readonly sendProviders: ConnectedMailboxProviderPort[],
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly tokenVault: MailboxTokenVaultService,
    private readonly audit: EmailSecurityAuditService,
  ) {}

  /** Exactly one refresh attempt — never retried indefinitely, matching
   * `ConnectedMailboxSendService`'s identical M28.6 precedent. */
  async getValidAccessToken(mailbox: ConnectedMailboxRecord): Promise<string> {
    const now = this.clock.now();
    const cachedAccessToken = this.tokenVault.decryptAccessToken(mailbox);
    if (cachedAccessToken && mailbox.accessTokenExpiresAt && mailbox.accessTokenExpiresAt.getTime() > now.getTime() + 60_000) {
      return cachedAccessToken;
    }

    const refreshToken = this.tokenVault.decryptRefreshToken(mailbox);
    const adapter = this.sendProviders.find((p) => p.provider === mailbox.provider);
    if (!adapter) {
      throw new Error(`No connected-mailbox provider adapter registered for "${mailbox.provider}".`);
    }

    let refreshed;
    try {
      refreshed = await adapter.refreshAccessToken(refreshToken);
    } catch (error) {
      const message = `Inbox access token refresh failed: ${error instanceof Error ? error.message : String(error)}`;
      await this.mailboxes.update(mailbox.id, { inboxReauthorizationRequired: true, inboxFailureCategory: 'AUTHENTICATION', inboxFailureReason: message }, now);
      await this.audit.record({ eventType: 'INBOX_REAUTHORIZATION_REQUIRED', connectedMailboxId: mailbox.id, userId: mailbox.userId, detail: message });
      throw new InboxAuthenticationError(message);
    }

    const encryptedAccess = this.tokenVault.encryptAccessToken(refreshed.accessToken);
    const newExpiresAt = new Date(now.getTime() + refreshed.expiresInSeconds * 1000);
    const patch: ConnectedMailboxUpdatePatch = {
      encryptedAccessToken: encryptedAccess.ciphertext,
      accessTokenExpiresAt: newExpiresAt,
      tokenEncryptionVersion: encryptedAccess.keyVersion,
      lastRefreshedAt: now,
      ...(refreshed.refreshToken ? { encryptedRefreshToken: this.tokenVault.encryptRefreshToken(refreshed.refreshToken).ciphertext } : {}),
    };
    await this.mailboxes.update(mailbox.id, patch, now);
    return refreshed.accessToken;
  }
}
