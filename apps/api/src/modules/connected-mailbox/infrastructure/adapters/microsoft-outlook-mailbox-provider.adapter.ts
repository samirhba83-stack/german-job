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

// Microsoft Graph's inline-attachment (fileAttachment) content is base64 embedded directly in the
// JSON request body — the real, documented practical ceiling before Graph requires the much more
// complex chunked upload-session API instead. Checked before any network call.
const GRAPH_MAX_INLINE_ATTACHMENT_TOTAL_BYTES = 3 * 1024 * 1024;

interface MicrosoftTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GraphUserResponse {
  id?: string;
  mail?: string | null;
  userPrincipalName?: string;
  displayName?: string | null;
}

interface GraphErrorBody {
  error?: { code?: string; message?: string };
}

interface GraphDraftMessageResponse {
  id?: string;
  conversationId?: string;
  /** M29 — Graph's own `internetMessageId` on a created message *is* the real RFC 5322
   * Message-ID header value that will appear on the sent email; captured, never invented. */
  internetMessageId?: string;
}

/**
 * M28.6 Phase 10 — real Microsoft Graph integration, hand-rolled REST (same rationale as the
 * Gmail adapter). Uses the real two-step create-draft-then-send flow
 * (`POST /me/messages` then `POST /me/messages/{id}/send`) rather than the simpler one-step
 * `POST /me/sendMail`, specifically because `sendMail` returns no body at all on success — the
 * two-step flow is the only way to genuinely capture a real Graph message id and conversation id
 * (Phase 10: "Capture provider message identifiers where available").
 */
@Injectable()
export class MicrosoftOutlookMailboxProviderAdapter implements ConnectedMailboxProviderPort {
  readonly provider = 'MICROSOFT_OUTLOOK' as const;
  private readonly logger = new Logger(MicrosoftOutlookMailboxProviderAdapter.name);

  constructor(private readonly config: ConfigService) {}

  private get clientId(): string {
    return this.config.get<string>('connectedMailbox.microsoft.clientId', '');
  }

  private get clientSecret(): string {
    return this.config.get<string>('connectedMailbox.microsoft.clientSecret', '');
  }

  private get tenant(): string {
    return this.config.get<string>('connectedMailbox.microsoft.tenant', 'common');
  }

  private get authorizeUrl(): string {
    return `https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/authorize`;
  }

  private get tokenUrl(): string {
    return `https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/token`;
  }

  buildAuthorizationUrl(params: AuthorizationUrlParams): string {
    const baseScopes = ['https://graph.microsoft.com/Mail.Send', 'https://graph.microsoft.com/User.Read', 'offline_access', 'openid'];
    // M29 — Graph inbox scopes are requested as their own resource-prefixed URIs (Graph does not
    // use Google's bare-scope-name style); `MICROSOFT_OUTLOOK_INBOX_REQUIRED_SCOPES` stores the
    // bare `Mail.Read` form (matching how granted scopes are reported back), so it is prefixed
    // here the same way `Mail.Send`/`User.Read` already are, immediately above.
    const additional = (params.additionalScopes ?? []).map((scope) => (scope.startsWith('https://') ? scope : `https://graph.microsoft.com/${scope}`));
    const scopes = additional.length > 0 ? [...new Set([...baseScopes, ...additional])] : baseScopes;

    const url = new URL(this.authorizeUrl);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', scopes.join(' '));
    url.searchParams.set('state', params.state);
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  async exchangeAuthorizationCode(code: string, codeVerifier: string, redirectUri: string): Promise<ExchangeCodeResult> {
    const response = await fetch(this.tokenUrl, {
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
    const body = (await response.json().catch(() => ({}))) as MicrosoftTokenResponse;
    if (!response.ok || !body.access_token) {
      throw new Error(`Microsoft token exchange failed: ${body.error ?? response.status} ${body.error_description ?? ''}`.trim());
    }
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? null,
      expiresInSeconds: body.expires_in ?? 3600,
      grantedScopes: (body.scope ?? '').split(' ').filter(Boolean),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<RefreshTokenResult> {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    });
    const body = (await response.json().catch(() => ({}))) as MicrosoftTokenResponse;
    if (!response.ok || !body.access_token) {
      throw new Error(`Microsoft token refresh failed: ${body.error ?? response.status} ${body.error_description ?? ''}`.trim());
    }
    // Unlike Google, Microsoft's identity platform ALWAYS rotates the refresh token on use — the
    // caller must persist this new value and the old one becomes invalid.
    return { accessToken: body.access_token, expiresInSeconds: body.expires_in ?? 3600, refreshToken: body.refresh_token ?? null };
  }

  /** Microsoft does not expose a scoped, per-app "revoke this refresh token" API the way Google
   * does — the only Graph-level session revocation (`/me/revokeSignInSessions`) revokes ALL of
   * the user's sessions across every application, which would be a real, unacceptable blast
   * radius for a single mailbox disconnect. Real revocation here means what this application
   * actually controls: destroying its own local copy of the token (done by the calling service),
   * matching the port's own documented "best-effort" contract. */
  async revokeAuthorization(_refreshToken: string): Promise<void> {
    this.logger.log('Microsoft Graph has no scoped per-app token revocation API — local token destruction is the real revocation for this provider.');
  }

  async getMailboxIdentity(accessToken: string): Promise<ProviderMailboxIdentity> {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = (await response.json().catch(() => ({}))) as GraphUserResponse;
    const emailAddress = body.mail ?? body.userPrincipalName ?? null;
    if (!response.ok || !body.id || !emailAddress) {
      throw new Error(`Failed to retrieve verified Microsoft mailbox identity: HTTP ${response.status}`);
    }
    return { providerAccountId: body.id, emailAddress, displayName: body.displayName ?? null };
  }

  async sendMessage(accessToken: string, request: MailboxSendRequest): Promise<MailboxSendResponse> {
    const totalAttachmentBytes = request.resolvedAttachments.reduce((sum, a) => sum + a.content.length, 0);
    if (totalAttachmentBytes > GRAPH_MAX_INLINE_ATTACHMENT_TOTAL_BYTES) {
      const message = `Attachments total ${totalAttachmentBytes} bytes, exceeding Microsoft Graph's ${GRAPH_MAX_INLINE_ATTACHMENT_TOTAL_BYTES}-byte inline-attachment limit.`;
      return { status: 'UNSUPPORTED', accepted: false, providerMessageId: null, providerThreadId: null, rfcMessageId: null, providerMessage: message, failure: { category: 'UNSUPPORTED_CAPABILITY', message, retryable: false } };
    }

    try {
      const messagePayload = {
        subject: request.subject,
        body: { contentType: request.htmlBody ? 'HTML' : 'Text', content: request.htmlBody ?? request.plainTextBody ?? '' },
        toRecipients: [{ emailAddress: { address: request.recipientEmailAddress } }],
        attachments: request.resolvedAttachments.map((a) => ({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: a.fileName,
          contentType: a.mimeType,
          contentBytes: a.content.toString('base64'),
        })),
      };

      const draftResponse = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(messagePayload),
      });

      if (!draftResponse.ok) {
        return this.mapErrorResponse(draftResponse.status, (await draftResponse.json().catch(() => ({}))) as GraphErrorBody, draftResponse.headers.get('retry-after'));
      }

      const draft = (await draftResponse.json().catch(() => ({}))) as GraphDraftMessageResponse;
      if (!draft.id) {
        return { status: 'FAILED', accepted: false, providerMessageId: null, providerThreadId: null, rfcMessageId: null, providerMessage: 'Graph draft creation returned no message id.', failure: { category: 'UNKNOWN', message: 'No message id returned.', retryable: true } };
      }

      const sendResponse = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${draft.id}/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!sendResponse.ok) {
        return this.mapErrorResponse(sendResponse.status, (await sendResponse.json().catch(() => ({}))) as GraphErrorBody, sendResponse.headers.get('retry-after'));
      }

      return {
        status: 'ACCEPTED',
        accepted: true,
        providerMessageId: draft.id,
        providerThreadId: draft.conversationId ?? null,
        rfcMessageId: draft.internetMessageId ?? null,
        providerMessage: 'Microsoft Graph accepted the message.',
        failure: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Outlook send failed for request "${request.requestId}": ${message}`);
      return { status: 'FAILED', accepted: false, providerMessageId: null, providerThreadId: null, rfcMessageId: null, providerMessage: `Network error calling Microsoft Graph: ${message}`, failure: { category: 'PROVIDER_UNAVAILABLE', message, retryable: true } };
    }
  }

  async checkHealth(accessToken: string): Promise<MailboxHealthCheckResult> {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      return response.ok ? { healthy: true, detail: 'Microsoft Graph reachable with the current access token.' } : { healthy: false, detail: `Graph /me check returned HTTP ${response.status}.` };
    } catch (error) {
      return { healthy: false, detail: `Microsoft Graph health check failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private mapErrorResponse(status: number, body: GraphErrorBody, retryAfterHeader: string | null): MailboxSendResponse {
    const baseMessage = body.error?.message ?? `Microsoft Graph returned HTTP ${status} with no message.`;
    const message = retryAfterHeader ? `${baseMessage} (Retry-After: ${retryAfterHeader}s)` : baseMessage;
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
