import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectedMailboxRepository, CONNECTED_MAILBOX_REPOSITORY } from '../../../connected-mailbox/domain/ports/connected-mailbox.repository';
import { OAuthTransactionRepository, OAUTH_TRANSACTION_REPOSITORY } from '../../../connected-mailbox/domain/ports/oauth-transaction.repository';
import { ConnectedMailboxProviderPort, CONNECTED_MAILBOX_PROVIDERS } from '../../../connected-mailbox/domain/ports/connected-mailbox-provider.port';
import { ConnectedMailboxRecord } from '../../../connected-mailbox/domain/models/connected-mailbox';
import { validateGrantedInboxScopes, inboxUpgradeScopesToRequestFor } from '../../../connected-mailbox/domain/services/oauth-scope-policy';
import { OAuthSecurityService } from '../../../connected-mailbox/application/services/oauth-security.service';
import { MailboxTokenVaultService } from '../../../connected-mailbox/application/services/mailbox-token-vault.service';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { InboxWatchService } from './inbox-watch.service';

export interface StartInboxUpgradeResult {
  readonly authorizationUrl: string;
}

export type InboxUpgradeFailureReason =
  | 'INVALID_STATE'
  | 'EXPIRED'
  | 'ALREADY_CONSUMED'
  | 'PROVIDER_ERROR'
  | 'MISSING_CODE'
  | 'TOKEN_EXCHANGE_FAILED'
  | 'SCOPE_REJECTED'
  | 'IDENTITY_VERIFICATION_FAILED'
  | 'MAILBOX_MISMATCH'
  | 'NO_REFRESH_TOKEN'
  | 'NO_ACTIVE_MAILBOX';

export type CompleteInboxUpgradeResult = { readonly success: true; readonly mailbox: ConnectedMailboxRecord } | { readonly success: false; readonly reason: InboxUpgradeFailureReason; readonly message: string };

/**
 * M29 Phase 2 — the separate inbox-consent upgrade flow. Deliberately mirrors
 * `MailboxConnectionService`'s own OAuth lifecycle shape (same single-use state/PKCE defense, same
 * fail-closed scope validation, same "identity comes only from the provider, never the frontend"
 * discipline) but is its own service: an inbox upgrade always applies to a mailbox the user has
 * ALREADY connected for sending (Phase 2: this is an upgrade, not a fresh connection) — never
 * creates a new `ConnectedMailbox` row, only extends the existing one's separate inbox-capability
 * fields. `completeInboxUpgrade()` additionally verifies the OAuth identity returned matches the
 * ALREADY-connected mailbox's own `providerAccountId` — an inbox upgrade can never silently
 * attach to a different real mailbox than the one already used for sending.
 */
@Injectable()
export class InboxConsentService {
  private readonly logger = new Logger(InboxConsentService.name);

  constructor(
    @Inject(CONNECTED_MAILBOX_REPOSITORY) private readonly mailboxes: ConnectedMailboxRepository,
    @Inject(OAUTH_TRANSACTION_REPOSITORY) private readonly transactions: OAuthTransactionRepository,
    @Inject(CONNECTED_MAILBOX_PROVIDERS) private readonly sendProviders: ConnectedMailboxProviderPort[],
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly oauthSecurity: OAuthSecurityService,
    private readonly tokenVault: MailboxTokenVaultService,
    private readonly watches: InboxWatchService,
    private readonly audit: EmailSecurityAuditService,
    private readonly config: ConfigService,
  ) {}

  async startInboxUpgrade(userId: string): Promise<StartInboxUpgradeResult> {
    const now = this.clock.now();
    const mailbox = await this.mailboxes.findActiveByUserId(userId);
    if (!mailbox || mailbox.status !== 'CONNECTED') {
      throw new NotFoundException('Connect a mailbox for sending first — inbox reading is an upgrade to an existing connection, not a standalone connection.');
    }

    const adapter = this.sendProviders.find((p) => p.provider === mailbox.provider);
    if (!adapter) {
      throw new Error(`No connected-mailbox provider adapter registered for "${mailbox.provider}".`);
    }

    const state = this.oauthSecurity.generateState();
    const codeVerifier = this.oauthSecurity.generateCodeVerifier();
    const codeChallenge = this.oauthSecurity.computeCodeChallenge(codeVerifier);
    const redirectUri = this.redirectUriFor(mailbox.provider);
    const expiryMinutes = this.config.get<number>('connectedMailbox.oauthTransaction.expiryMinutes', 10);
    const expiresAt = new Date(now.getTime() + expiryMinutes * 60_000);

    await this.transactions.create({ state, userId, provider: mailbox.provider, capability: 'READ_APPLICATION_REPLIES', codeVerifier, redirectUri, expiresAt }, now);
    await this.audit.record({ eventType: 'INBOX_CONSENT_STARTED', userId, connectedMailboxId: mailbox.id, detail: `Started inbox-reading upgrade for ${mailbox.provider}.` });

    const authorizationUrl = adapter.buildAuthorizationUrl({ state, codeChallenge, redirectUri, additionalScopes: inboxUpgradeScopesToRequestFor(mailbox.provider) });
    return { authorizationUrl };
  }

  /** Same "no JwtAuthGuard on the callback, derive the user from the transaction" model as
   * `MailboxConnectionService.completeConnection()` — see that method's own doc comment for the
   * full RFC 6749 §10.12 rationale, unchanged here. Takes the raw `state` (not a pre-fetched
   * transaction) and performs the FULL lookup/expiry/single-use-consumption sequence itself —
   * the callback controller's own peek at `capability` is read-only and never substitutes for
   * this method's own real validation. */
  async completeInboxUpgrade(state: string, code: string | null, providerError: string | null): Promise<CompleteInboxUpgradeResult> {
    const now = this.clock.now();
    const transaction = await this.transactions.findByState(state);
    if (!transaction) {
      return { success: false, reason: 'INVALID_STATE', message: 'This authorization link is invalid or has already been used.' };
    }
    if (transaction.expiresAt.getTime() < now.getTime()) {
      return { success: false, reason: 'EXPIRED', message: 'This authorization attempt has expired — please try again.' };
    }
    if (transaction.status !== 'PENDING') {
      return { success: false, reason: 'ALREADY_CONSUMED', message: 'This authorization attempt has already been completed.' };
    }

    const consumed = await this.transactions.tryConsume(state, now);
    if (!consumed) {
      // Lost a genuine concurrent race for the same state — the other request already consumed it.
      return { success: false, reason: 'ALREADY_CONSUMED', message: 'This authorization attempt has already been completed.' };
    }

    if (providerError) {
      await this.audit.record({ eventType: 'INBOX_CONSENT_REJECTED', userId: transaction.userId, detail: `Provider returned an error: ${providerError}` });
      return { success: false, reason: 'PROVIDER_ERROR', message: 'Inbox authorization was not completed.' };
    }
    if (!code) {
      return { success: false, reason: 'MISSING_CODE', message: 'Inbox authorization was not completed.' };
    }

    const mailbox = await this.mailboxes.findActiveByUserId(transaction.userId);
    if (!mailbox) {
      return { success: false, reason: 'NO_ACTIVE_MAILBOX', message: 'No connected mailbox found to upgrade — connect one for sending first.' };
    }

    const adapter = this.sendProviders.find((p) => p.provider === transaction.provider);
    if (!adapter) {
      throw new Error(`No connected-mailbox provider adapter registered for "${transaction.provider}".`);
    }

    let exchanged;
    try {
      exchanged = await adapter.exchangeAuthorizationCode(code, transaction.codeVerifier, transaction.redirectUri);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.audit.record({ eventType: 'INBOX_CONSENT_REJECTED', userId: transaction.userId, connectedMailboxId: mailbox.id, detail: `Token exchange failed: ${message}` });
      return { success: false, reason: 'TOKEN_EXCHANGE_FAILED', message: 'Could not complete authorization with the provider.' };
    }

    const scopeCheck = validateGrantedInboxScopes(transaction.provider, exchanged.grantedScopes);
    if (!scopeCheck.accepted) {
      await this.audit.record({
        eventType: 'INBOX_CONSENT_REJECTED',
        userId: transaction.userId,
        connectedMailboxId: mailbox.id,
        detail: `Scope validation failed: missing=[${scopeCheck.missingRequiredScopes.join(',')}] unexpected=[${scopeCheck.unexpectedScopes.join(',')}]`,
      });
      return { success: false, reason: 'SCOPE_REJECTED', message: 'The required inbox-reading permission was not granted, or additional unexpected permissions were requested.' };
    }

    let identity;
    try {
      identity = await adapter.getMailboxIdentity(exchanged.accessToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.audit.record({ eventType: 'INBOX_CONSENT_REJECTED', userId: transaction.userId, connectedMailboxId: mailbox.id, detail: `Identity verification failed: ${message}` });
      return { success: false, reason: 'IDENTITY_VERIFICATION_FAILED', message: 'Could not verify the connected mailbox address.' };
    }

    // Never let an inbox upgrade silently attach to a different real mailbox than the one
    // already used for sending — the ONLY source of truth is the provider's own identity call.
    if (identity.providerAccountId !== mailbox.providerAccountId) {
      await this.audit.record({
        eventType: 'INBOX_CONSENT_REJECTED',
        userId: transaction.userId,
        connectedMailboxId: mailbox.id,
        detail: `Identity mismatch: upgrade authorized as "${identity.emailAddress}", but the connected mailbox is "${mailbox.emailAddress}".`,
      });
      return { success: false, reason: 'MAILBOX_MISMATCH', message: 'The account you authorized does not match your connected mailbox. Please sign in with the same account you use for sending.' };
    }

    if (!exchanged.refreshToken) {
      await this.audit.record({ eventType: 'INBOX_CONSENT_REJECTED', userId: transaction.userId, connectedMailboxId: mailbox.id, detail: 'Provider did not issue a refresh token.' });
      return { success: false, reason: 'NO_REFRESH_TOKEN', message: 'The provider did not grant persistent access — please try again.' };
    }

    const encryptedRefresh = this.tokenVault.encryptRefreshToken(exchanged.refreshToken);
    const encryptedAccess = this.tokenVault.encryptAccessToken(exchanged.accessToken);
    const accessTokenExpiresAt = new Date(now.getTime() + exchanged.expiresInSeconds * 1000);

    const updated = await this.mailboxes.update(
      mailbox.id,
      {
        // The new token now covers the UNION of scopes — replaces the stored send-only token,
        // sending keeps working under the same (now broader) credential.
        encryptedRefreshToken: encryptedRefresh.ciphertext,
        encryptedAccessToken: encryptedAccess.ciphertext,
        accessTokenExpiresAt,
        tokenEncryptionVersion: encryptedRefresh.keyVersion,
        hasRefreshToken: true,
        grantedScopes: exchanged.grantedScopes,
        inboxCapabilityStatus: 'ACTIVE',
        inboxGrantedScopes: exchanged.grantedScopes,
        inboxConsentVersion: this.config.get<string>('inboxIntelligence.consent.version', '1.0'),
        inboxConsentAcceptedAt: now,
        inboxReauthorizationRequired: false,
        inboxUserDisabled: false,
        inboxFailureCategory: null,
        inboxFailureReason: null,
      },
      now,
    );

    await this.audit.record({ eventType: 'INBOX_CONSENT_GRANTED', userId: transaction.userId, connectedMailboxId: mailbox.id, detail: `Inbox reading authorized for ${identity.emailAddress}.` });

    try {
      await this.watches.registerWatch(updated);
    } catch (error) {
      // The consent grant itself succeeded and is real — a watch-registration failure is a
      // separate, recoverable operational issue (the renewal job / admin force-renewal can retry),
      // never a reason to roll back a genuine, already-completed consent.
      this.logger.warn(`Inbox watch registration failed immediately after consent for mailbox "${updated.id}": ${error instanceof Error ? error.message : String(error)}`);
    }

    return { success: true, mailbox: updated };
  }

  async revokeInboxAccess(userId: string, mailboxId: string): Promise<void> {
    const now = this.clock.now();
    const mailbox = await this.mailboxes.findById(mailboxId);
    if (!mailbox || mailbox.userId !== userId) {
      throw new NotFoundException('Connected mailbox not found.');
    }

    await this.watches.stopWatch(mailbox);

    await this.mailboxes.update(
      mailboxId,
      { inboxCapabilityStatus: 'USER_DISABLED', inboxUserDisabled: true, inboxRevokedAt: now },
      now,
    );
    // Deliberately does NOT touch encryptedRefreshToken/encryptedAccessToken/status/grantedScopes
    // — Non-Negotiable Principle #15: sending must keep working. Neither Gmail nor Microsoft Graph
    // supports true provider-side PARTIAL scope revocation (revoking only the inbox-read grant
    // while keeping send) — see the M29 report's own ADR for why this is an honest, real
    // limitation: this application enforces the read/write boundary itself (stops watching,
    // refuses to read) rather than attempting a provider operation that does not exist.
    await this.audit.record({ eventType: 'INBOX_CONSENT_REVOKED', userId, connectedMailboxId: mailboxId, detail: 'User-initiated inbox-access revocation.' });
  }

  private redirectUriFor(provider: 'GOOGLE_GMAIL' | 'MICROSOFT_OUTLOOK'): string {
    return provider === 'GOOGLE_GMAIL'
      ? this.config.get<string>('connectedMailbox.google.redirectUri', '')
      : this.config.get<string>('connectedMailbox.microsoft.redirectUri', '');
  }
}
