import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectedMailboxProviderPort, AuthorizationUrlParams } from '../../domain/ports/connected-mailbox-provider.port';
import {
  ExchangeCodeResult,
  MailboxHealthCheckResult,
  MailboxSendRequest,
  MailboxSendResponse,
  ProviderMailboxIdentity,
  RefreshTokenResult,
} from '../../domain/models/mailbox-send';
import { ProviderFailureCategory } from '../../../email-provider/domain/models/provider-failure';
import { buildRawMimeEmail } from '../../../email-provider/infrastructure/adapters/mime-message-builder';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const GMAIL_PROFILE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfoResponse {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

interface GmailErrorBody {
  error?: { code?: number; message?: string; status?: string };
}

/**
 * M28.6 Phase 9 — real Gmail API integration, hand-rolled REST (same rationale as Resend/SendGrid,
 * M28: a bearer-token JSON API doesn't justify a full SDK's dependency surface, and the OAuth
 * token-exchange/refresh calls are simple, well-documented POSTs). Reuses `buildRawMimeEmail`
 * (M28.5, `email-provider` module) for real MIME construction — the same header-injection-safe
 * builder SES uses, base64url-encoded per Gmail's `users.messages.send` API contract, rather than
 * a second, parallel MIME implementation.
 */
@Injectable()
export class GmailMailboxProviderAdapter implements ConnectedMailboxProviderPort {
  readonly provider = 'GOOGLE_GMAIL' as const;
  private readonly logger = new Logger(GmailMailboxProviderAdapter.name);

  constructor(private readonly config: ConfigService) {}

  private get clientId(): string {
    return this.config.get<string>('connectedMailbox.google.clientId', '');
  }

  private get clientSecret(): string {
    return this.config.get<string>('connectedMailbox.google.clientSecret', '');
  }

  buildAuthorizationUrl(params: AuthorizationUrlParams): string {
    const baseScopes = ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email', 'openid'];
    const scopes = params.additionalScopes ? [...new Set([...baseScopes, ...params.additionalScopes])] : baseScopes;

    const url = new URL(AUTH_URL);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', scopes.join(' '));
    url.searchParams.set('state', params.state);
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    // access_type=offline + prompt=consent are what actually make Google issue a refresh token —
    // without both, a returning user who already granted consent gets no refresh_token at all.
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    // M29 — real incremental authorization (https://developers.google.com/identity/protocols/
    // oauth2/web-server#incrementalAuth): tells Google this request's scopes should be UNIONED
    // with whatever the user already granted, rather than issuing a token that silently narrows
    // back to just this request's scopes. Harmless (a no-op) on the very first, send-only
    // connection since there is nothing prior to union with yet.
    url.searchParams.set('include_granted_scopes', 'true');
    return url.toString();
  }

  async exchangeAuthorizationCode(code: string, codeVerifier: string, redirectUri: string): Promise<ExchangeCodeResult> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const body = (await response.json().catch(() => ({}))) as GoogleTokenResponse;
    if (!response.ok || !body.access_token) {
      throw new Error(`Google token exchange failed: ${body.error ?? response.status} ${body.error_description ?? ''}`.trim());
    }
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? null,
      expiresInSeconds: body.expires_in ?? 3600,
      grantedScopes: (body.scope ?? '').split(' ').filter(Boolean),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<RefreshTokenResult> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    });
    const body = (await response.json().catch(() => ({}))) as GoogleTokenResponse;
    if (!response.ok || !body.access_token) {
      throw new Error(`Google token refresh failed: ${body.error ?? response.status} ${body.error_description ?? ''}`.trim());
    }
    // Google does not rotate refresh tokens on a normal refresh call — it simply doesn't return
    // a new one, which correctly signals "keep using the one you already have."
    return { accessToken: body.access_token, expiresInSeconds: body.expires_in ?? 3600, refreshToken: body.refresh_token ?? null };
  }

  async revokeAuthorization(refreshToken: string): Promise<void> {
    try {
      await fetch(REVOKE_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: refreshToken }) });
    } catch (error) {
      this.logger.warn(`Google token revocation call failed (treated as best-effort): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getMailboxIdentity(accessToken: string): Promise<ProviderMailboxIdentity> {
    const response = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = (await response.json().catch(() => ({}))) as GoogleUserInfoResponse;
    if (!response.ok || !body.sub || !body.email) {
      throw new Error(`Failed to retrieve verified Google mailbox identity: HTTP ${response.status}`);
    }
    return { providerAccountId: body.sub, emailAddress: body.email, displayName: body.name ?? null };
  }

  /** M29 — a domain we own for the sole purpose of Message-ID uniqueness tokens; it never needs
   * to resolve via DNS (RFC 5322 does not require that), it only needs to be a stable, real
   * namespace so two independently-generated ids can never collide with another system's. */
  private get messageIdDomain(): string {
    return this.config.get<string>('connectedMailbox.messageIdDomain', 'mail.germanjobengine.internal');
  }

  async sendMessage(accessToken: string, request: MailboxSendRequest): Promise<MailboxSendResponse> {
    const messageIdHeader = `<${randomUUID()}.${request.requestId}@${this.messageIdDomain}>`;
    try {
      const rawMessage = buildRawMimeEmail({
        fromDisplayName: request.fromDisplayName,
        fromEmailAddress: request.fromEmailAddress,
        toEmailAddress: request.recipientEmailAddress,
        replyToEmailAddress: null,
        subject: request.subject,
        plainTextBody: request.plainTextBody,
        htmlBody: request.htmlBody,
        attachments: request.resolvedAttachments.map((a) => ({ fileName: a.fileName, mimeType: a.mimeType, content: a.content })),
        messageIdHeader,
      });

      const response = await fetch(GMAIL_SEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: rawMessage.toString('base64url') }),
      });

      if (response.ok) {
        const body = (await response.json().catch(() => ({}))) as { id?: string; threadId?: string };
        return { status: 'ACCEPTED', accepted: true, providerMessageId: body.id ?? null, providerThreadId: body.threadId ?? null, rfcMessageId: messageIdHeader, providerMessage: 'Gmail accepted the message.', failure: null };
      }

      return this.mapErrorResponse(response.status, (await response.json().catch(() => ({}))) as GmailErrorBody);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Gmail send failed for request "${request.requestId}": ${message}`);
      return { status: 'FAILED', accepted: false, providerMessageId: null, providerThreadId: null, rfcMessageId: null, providerMessage: `Network error calling Gmail: ${message}`, failure: { category: 'PROVIDER_UNAVAILABLE', message, retryable: true } };
    }
  }

  async checkHealth(accessToken: string): Promise<MailboxHealthCheckResult> {
    try {
      const response = await fetch(GMAIL_PROFILE_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
      return response.ok ? { healthy: true, detail: 'Gmail API reachable with the current access token.' } : { healthy: false, detail: `Gmail profile check returned HTTP ${response.status}.` };
    } catch (error) {
      return { healthy: false, detail: `Gmail health check failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private mapErrorResponse(status: number, body: GmailErrorBody): MailboxSendResponse {
    const message = body.error?.message ?? `Gmail returned HTTP ${status} with no message.`;
    const category = this.categorize(status);
    return {
      status: category === 'RATE_LIMITED' ? 'DEFERRED' : 'FAILED',
      accepted: false,
      providerMessageId: null,
      providerThreadId: null,
      rfcMessageId: null,
      providerMessage: message,
      failure: { category, message, retryable: category === 'RATE_LIMITED' || category === 'PROVIDER_UNAVAILABLE' },
    };
  }

  private categorize(status: number): ProviderFailureCategory {
    if (status === 401 || status === 403) return 'AUTHENTICATION';
    if (status === 429) return 'RATE_LIMITED';
    if (status >= 500) return 'PROVIDER_UNAVAILABLE';
    return 'UNKNOWN';
  }
}
