import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectedMailboxRepository, CONNECTED_MAILBOX_REPOSITORY } from '../../domain/ports/connected-mailbox.repository';
import { OAuthTransactionRepository, OAUTH_TRANSACTION_REPOSITORY } from '../../domain/ports/oauth-transaction.repository';
import { ConnectedMailboxProviderPort, CONNECTED_MAILBOX_PROVIDERS } from '../../domain/ports/connected-mailbox-provider.port';
import { ConnectedMailboxProvider, ConnectedMailboxRecord } from '../../domain/models/connected-mailbox';
import { OAuthTransactionRecord } from '../../domain/models/oauth-transaction';
import { validateGrantedScopes } from '../../domain/services/oauth-scope-policy';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { OAuthSecurityService } from './oauth-security.service';
import { MailboxTokenVaultService } from './mailbox-token-vault.service';

export interface StartConnectionResult {
  readonly authorizationUrl: string;
}

export type ConnectionFailureReason =
  | 'INVALID_STATE'
  | 'EXPIRED'
  | 'ALREADY_CONSUMED'
  | 'PROVIDER_ERROR'
  | 'MISSING_CODE'
  | 'TOKEN_EXCHANGE_FAILED'
  | 'SCOPE_REJECTED'
  | 'IDENTITY_VERIFICATION_FAILED'
  | 'NO_REFRESH_TOKEN';

export type CompleteConnectionResult = { readonly success: true; readonly mailbox: ConnectedMailboxRecord } | { readonly success: false; readonly reason: ConnectionFailureReason; readonly message: string };

/**
 * M28.6 — orchestrates the full OAuth lifecycle: start (build a real authorization URL, record a
 * short-lived transaction), complete (the callback — verify state/single-use, exchange the code,
 * validate scopes, verify identity from the provider itself, encrypt and store tokens), and
 * disconnect (best-effort provider revocation + real local token destruction). Never trusts a
 * frontend-supplied email address as mailbox ownership proof (Phase 5) — `getMailboxIdentity()`
 * is the only source of truth.
 */
@Injectable()
export class MailboxConnectionService {
  private readonly logger = new Logger(MailboxConnectionService.name);

  constructor(
    @Inject(CONNECTED_MAILBOX_REPOSITORY) private readonly mailboxes: ConnectedMailboxRepository,
    @Inject(OAUTH_TRANSACTION_REPOSITORY) private readonly transactions: OAuthTransactionRepository,
    @Inject(CONNECTED_MAILBOX_PROVIDERS) private readonly providers: ConnectedMailboxProviderPort[],
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly oauthSecurity: OAuthSecurityService,
    private readonly tokenVault: MailboxTokenVaultService,
    private readonly audit: EmailSecurityAuditService,
    private readonly config: ConfigService,
  ) {}

  private resolveProvider(provider: ConnectedMailboxProvider): ConnectedMailboxProviderPort {
    const adapter = this.providers.find((p) => p.provider === provider);
    if (!adapter) {
      throw new Error(`No connected-mailbox provider adapter registered for "${provider}".`);
    }
    return adapter;
  }

  async startConnection(userId: string, provider: ConnectedMailboxProvider): Promise<StartConnectionResult> {
    const now = this.clock.now();
    const adapter = this.resolveProvider(provider);
    const state = this.oauthSecurity.generateState();
    const codeVerifier = this.oauthSecurity.generateCodeVerifier();
    const codeChallenge = this.oauthSecurity.computeCodeChallenge(codeVerifier);
    const redirectUri = this.redirectUriFor(provider);
    const expiryMinutes = this.config.get<number>('connectedMailbox.oauthTransaction.expiryMinutes', 10);
    const expiresAt = new Date(now.getTime() + expiryMinutes * 60_000);

    await this.transactions.create({ state, userId, provider, capability: 'SEND_APPLICATION_EMAIL', codeVerifier, redirectUri, expiresAt }, now);
    await this.audit.record({ eventType: 'MAILBOX_CONNECTION_STARTED', userId, detail: `Started ${provider} connection.` });

    const authorizationUrl = adapter.buildAuthorizationUrl({ state, codeChallenge, redirectUri });
    return { authorizationUrl };
  }

  /**
   * The OAuth callback handler. Deliberately does NOT require a fresh bearer token — a top-level
   * browser redirect from Google/Microsoft carries no custom Authorization header. The acting
   * user is derived exclusively from the looked-up `OAuthTransaction.userId`, recorded at start
   * time while the user WAS authenticated — this is the standard, secure OAuth authorization-code
   * flow model (the unguessable, single-use `state` value IS the CSRF/binding defense, per RFC
   * 6749 §10.12), not a gap.
   */
  async completeConnection(state: string, code: string | null, providerError: string | null): Promise<CompleteConnectionResult> {
    const now = this.clock.now();
    const transaction = await this.transactions.findByState(state);
    if (!transaction) {
      return { success: false, reason: 'INVALID_STATE', message: 'This authorization link is invalid or has already been used.' };
    }
    if (transaction.expiresAt.getTime() < now.getTime()) {
      return { success: false, reason: 'EXPIRED', message: 'This authorization attempt has expired — please try connecting again.' };
    }
    if (transaction.status !== 'PENDING') {
      // A second callback for an already-consumed state is a genuine replay attempt (or a
      // double-submitted browser callback) — reject it, never process it a second time.
      return { success: false, reason: 'ALREADY_CONSUMED', message: 'This authorization attempt has already been completed.' };
    }

    const consumed = await this.transactions.tryConsume(state, now);
    if (!consumed) {
      // Lost a genuine concurrent race for the same state — the other request already consumed it.
      return { success: false, reason: 'ALREADY_CONSUMED', message: 'This authorization attempt has already been completed.' };
    }

    if (providerError) {
      await this.audit.record({ eventType: 'MAILBOX_CONNECTION_FAILED', userId: transaction.userId, detail: `Provider returned an error: ${providerError}` });
      return { success: false, reason: 'PROVIDER_ERROR', message: 'Authorization was not completed.' };
    }
    if (!code) {
      return { success: false, reason: 'MISSING_CODE', message: 'Authorization was not completed.' };
    }

    return this.finishExchange(transaction, code, now);
  }

  private async finishExchange(transaction: OAuthTransactionRecord, code: string, now: Date): Promise<CompleteConnectionResult> {
    const adapter = this.resolveProvider(transaction.provider);

    let exchanged;
    try {
      exchanged = await adapter.exchangeAuthorizationCode(code, transaction.codeVerifier, transaction.redirectUri);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.audit.record({ eventType: 'MAILBOX_CONNECTION_FAILED', userId: transaction.userId, detail: `Token exchange failed: ${message}` });
      return { success: false, reason: 'TOKEN_EXCHANGE_FAILED', message: 'Could not complete authorization with the provider.' };
    }

    const scopeCheck = validateGrantedScopes(transaction.provider, exchanged.grantedScopes);
    if (!scopeCheck.accepted) {
      await this.audit.record({
        eventType: 'MAILBOX_SCOPE_REJECTED',
        userId: transaction.userId,
        detail: `missing=[${scopeCheck.missingRequiredScopes.join(',')}] unexpected=[${scopeCheck.unexpectedScopes.join(',')}]`,
      });
      return { success: false, reason: 'SCOPE_REJECTED', message: 'The required permission was not granted, or additional unexpected permissions were requested.' };
    }

    let identity;
    try {
      identity = await adapter.getMailboxIdentity(exchanged.accessToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.audit.record({ eventType: 'MAILBOX_CONNECTION_FAILED', userId: transaction.userId, detail: `Identity verification failed: ${message}` });
      return { success: false, reason: 'IDENTITY_VERIFICATION_FAILED', message: 'Could not verify the connected mailbox address.' };
    }
    await this.audit.record({ eventType: 'MAILBOX_IDENTITY_VERIFIED', userId: transaction.userId, detail: `Verified ${identity.emailAddress} via ${transaction.provider}.` });

    if (!exchanged.refreshToken) {
      await this.audit.record({ eventType: 'MAILBOX_CONNECTION_FAILED', userId: transaction.userId, detail: 'Provider did not issue a refresh token.' });
      return { success: false, reason: 'NO_REFRESH_TOKEN', message: 'The provider did not grant persistent access — please try connecting again.' };
    }

    const currentActive = await this.mailboxes.findActiveByUserId(transaction.userId);
    if (currentActive && currentActive.providerAccountId !== identity.providerAccountId) {
      this.logger.log(`User ${transaction.userId} switched their active connected mailbox from "${currentActive.emailAddress}" to "${identity.emailAddress}".`);
    }

    const encryptedRefresh = this.tokenVault.encryptRefreshToken(exchanged.refreshToken);
    const encryptedAccess = this.tokenVault.encryptAccessToken(exchanged.accessToken);
    const accessTokenExpiresAt = new Date(now.getTime() + exchanged.expiresInSeconds * 1000);

    const mailbox = await this.mailboxes.createConnected(
      {
        userId: transaction.userId,
        provider: transaction.provider,
        providerAccountId: identity.providerAccountId,
        emailAddress: identity.emailAddress,
        displayName: identity.displayName,
        grantedScopes: exchanged.grantedScopes,
        encryptedRefreshToken: encryptedRefresh.ciphertext,
        encryptedAccessToken: encryptedAccess.ciphertext,
        accessTokenExpiresAt,
        tokenEncryptionVersion: encryptedRefresh.keyVersion,
        hasRefreshToken: true,
        consentVersion: this.config.get<string>('connectedMailbox.consent.version', '1.0'),
      },
      now,
    );

    await this.audit.record({
      eventType: 'MAILBOX_CONNECTION_COMPLETED',
      userId: transaction.userId,
      connectedMailboxId: mailbox.id,
      detail: `Connected "${identity.emailAddress}" via ${transaction.provider}.`,
    });

    return { success: true, mailbox };
  }

  async disconnect(userId: string, mailboxId: string): Promise<void> {
    const now = this.clock.now();
    const mailbox = await this.mailboxes.findById(mailboxId);
    if (!mailbox) {
      throw new NotFoundException('Connected mailbox not found.');
    }
    if (mailbox.userId !== userId) {
      // Never reveal whether the id belongs to someone else — same "not found" shape either way.
      throw new NotFoundException('Connected mailbox not found.');
    }

    if (mailbox.encryptedRefreshToken) {
      try {
        const refreshToken = this.tokenVault.decryptRefreshToken(mailbox);
        const adapter = this.resolveProvider(mailbox.provider);
        await adapter.revokeAuthorization(refreshToken);
      } catch (error) {
        this.logger.warn(`Best-effort provider revocation failed for mailbox "${mailboxId}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    await this.mailboxes.update(
      mailboxId,
      {
        status: 'USER_DISABLED',
        userDisabled: true,
        isActive: false,
        encryptedRefreshToken: null,
        encryptedAccessToken: null,
        hasRefreshToken: false,
        tokenEncryptionVersion: null,
      },
      now,
    );

    await this.audit.record({ eventType: 'MAILBOX_DISCONNECTED', userId, connectedMailboxId: mailboxId, detail: 'User-initiated disconnect.' });
  }

  /** Phase 19 admin operations — every action requires a mandatory reason and records the acting
   * admin id in `detail` while keeping `userId` on the audit record as the mailbox OWNER (not the
   * admin), so a user's own audit trail still surfaces admin actions taken on their mailbox —
   * matching `AdminEmailController`'s existing sender-identity suspend/reactivate precedent. */
  async adminSuspend(mailboxId: string, adminId: string, reason: string): Promise<ConnectedMailboxRecord> {
    const now = this.clock.now();
    const mailbox = await this.requireMailbox(mailboxId);
    const updated = await this.mailboxes.update(mailboxId, { status: 'SYSTEM_SUSPENDED', systemSuspended: true, suspensionReason: reason }, now);
    await this.audit.record({
      eventType: 'MAILBOX_SYSTEM_SUSPENDED',
      userId: mailbox.userId,
      connectedMailboxId: mailboxId,
      detail: `Suspended by admin ${adminId}: ${reason}`,
    });
    return updated;
  }

  async adminRestore(mailboxId: string, adminId: string, reason: string): Promise<ConnectedMailboxRecord> {
    const now = this.clock.now();
    const mailbox = await this.requireMailbox(mailboxId);
    const restoredStatus = mailbox.hasRefreshToken ? 'CONNECTED' : 'REAUTHORIZATION_REQUIRED';
    const updated = await this.mailboxes.update(
      mailboxId,
      { status: restoredStatus, systemSuspended: false, suspensionReason: null, reauthorizationRequired: restoredStatus === 'REAUTHORIZATION_REQUIRED' },
      now,
    );
    await this.audit.record({
      eventType: 'MAILBOX_SYSTEM_SUSPENDED',
      userId: mailbox.userId,
      connectedMailboxId: mailboxId,
      detail: `Restored by admin ${adminId}: ${reason} (new status: ${restoredStatus})`,
    });
    return updated;
  }

  /** Forces re-consent even though the current token may still work — used when a mailbox's
   * granted scopes or provider identity are suspected stale/incorrect, without waiting for a real
   * refresh failure to discover it. */
  async adminForceReauthorization(mailboxId: string, adminId: string, reason: string): Promise<ConnectedMailboxRecord> {
    const now = this.clock.now();
    const mailbox = await this.requireMailbox(mailboxId);
    const updated = await this.mailboxes.update(mailboxId, { status: 'REAUTHORIZATION_REQUIRED', reauthorizationRequired: true }, now);
    await this.audit.record({
      eventType: 'MAILBOX_REAUTHORIZATION_REQUIRED',
      userId: mailbox.userId,
      connectedMailboxId: mailboxId,
      detail: `Forced by admin ${adminId}: ${reason}`,
    });
    return updated;
  }

  /** The admin equivalent of a compromised-integration kill switch — best-effort provider
   * revocation plus real local token destruction, same as user-initiated `disconnect()`, but
   * without the ownership check (an admin legitimately acts on any user's mailbox) and recorded as
   * `MAILBOX_REVOKED` rather than `MAILBOX_DISCONNECTED` to distinguish "this application decided
   * to cut access" from "the user chose to disconnect." */
  async adminDisconnect(mailboxId: string, adminId: string, reason: string): Promise<ConnectedMailboxRecord> {
    const now = this.clock.now();
    const mailbox = await this.requireMailbox(mailboxId);

    if (mailbox.encryptedRefreshToken) {
      try {
        const refreshToken = this.tokenVault.decryptRefreshToken(mailbox);
        const adapter = this.resolveProvider(mailbox.provider);
        await adapter.revokeAuthorization(refreshToken);
      } catch (error) {
        this.logger.warn(`Best-effort provider revocation failed for mailbox "${mailboxId}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const updated = await this.mailboxes.update(
      mailboxId,
      {
        status: 'REVOKED',
        isActive: false,
        encryptedRefreshToken: null,
        encryptedAccessToken: null,
        hasRefreshToken: false,
        tokenEncryptionVersion: null,
      },
      now,
    );

    await this.audit.record({
      eventType: 'MAILBOX_REVOKED',
      userId: mailbox.userId,
      connectedMailboxId: mailboxId,
      detail: `Revoked by admin ${adminId}: ${reason}`,
    });
    return updated;
  }

  private async requireMailbox(mailboxId: string): Promise<ConnectedMailboxRecord> {
    const mailbox = await this.mailboxes.findById(mailboxId);
    if (!mailbox) {
      throw new NotFoundException('Connected mailbox not found.');
    }
    return mailbox;
  }

  private redirectUriFor(provider: ConnectedMailboxProvider): string {
    return provider === 'GOOGLE_GMAIL'
      ? this.config.get<string>('connectedMailbox.google.redirectUri', '')
      : this.config.get<string>('connectedMailbox.microsoft.redirectUri', '');
  }
}
