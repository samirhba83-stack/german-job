import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectedInboxProviderPort, RegisterWatchResult, FetchChangesResult, ThrottleInfo } from '../../domain/ports/connected-inbox-provider.port';
import { ProviderInboxMessageMetadata, ProviderInboxMessageContent, ChangedMessageRef } from '../../domain/models/provider-inbox-message';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
// Graph caps a mail-resource subscription's lifetime at roughly 3 days (4230 minutes) — real,
// documented provider limit, not a value this application chose.
const SUBSCRIPTION_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000; // 3 days minus a 1h safety margin

interface GraphSubscriptionResponse {
  id?: string;
  expirationDateTime?: string;
}

interface GraphDeltaResponse {
  value?: Array<{ id?: string; conversationId?: string; '@removed'?: unknown }>;
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
}

interface GraphRecipient {
  emailAddress?: { address?: string; name?: string };
}

interface GraphMessageResponse {
  id?: string;
  conversationId?: string;
  internetMessageId?: string;
  internetMessageHeaders?: Array<{ name?: string; value?: string }>;
  from?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  subject?: string;
  receivedDateTime?: string;
  body?: { contentType?: string; content?: string };
  hasAttachments?: boolean;
  isDeliveryReceiptRequested?: boolean | null;
  /** Graph's own approximate message size in bytes — real, requested via `$select` below, and the
   * only thing that makes `PrivacyFilterPolicy`'s `maxAllowedSizeBytes` guard mean anything for
   * Outlook (a hardcoded 0 here would make that check permanently pass regardless of real size). */
  size?: number;
}

interface GraphAttachmentListResponse {
  value?: Array<{ name?: string; contentType?: string; size?: number }>;
}

function headerValue(headers: Array<{ name?: string; value?: string }> | undefined, name: string): string | null {
  const found = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return found?.value ?? null;
}

function parseReferences(raw: string | null): string[] {
  return raw ? raw.split(/\s+/).filter(Boolean) : [];
}

/**
 * M29 Phase 4/5/8 — real Microsoft Graph integration for inbox reading. Uses Graph's real
 * `subscription` resource (webhook push) for near-real-time notification, and Graph's real delta
 * query (`/messages/delta`) as the durable change-cursor mechanism the webhook notification tells
 * this application to re-poll against — the notification payload itself never carries message
 * content (Graph's own documented, intentional design, mirroring Gmail's `historyId` model).
 */
@Injectable()
export class MicrosoftOutlookInboxProviderAdapter implements ConnectedInboxProviderPort {
  readonly provider = 'MICROSOFT_OUTLOOK' as const;
  private readonly logger = new Logger(MicrosoftOutlookInboxProviderAdapter.name);

  constructor(private readonly config: ConfigService) {}

  private get notificationUrl(): string {
    return this.config.get<string>('inboxIntelligence.microsoft.webhookNotificationUrl', '');
  }

  private get clientState(): string {
    return this.config.get<string>('inboxIntelligence.microsoft.webhookClientState', '');
  }

  async registerWatch(accessToken: string, _mailboxUserEmail: string): Promise<RegisterWatchResult> {
    const expirationDateTime = new Date(Date.now() + SUBSCRIPTION_LIFETIME_MS).toISOString();
    const response = await fetch(`${GRAPH_BASE}/subscriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changeType: 'created',
        notificationUrl: this.notificationUrl,
        resource: "me/mailFolders('inbox')/messages",
        expirationDateTime,
        clientState: this.clientState,
      }),
    });
    if (!response.ok) {
      throw new Error(`Graph subscription registration failed: HTTP ${response.status}`);
    }
    const body = (await response.json().catch(() => ({}))) as GraphSubscriptionResponse;
    if (!body.id || !body.expirationDateTime) {
      throw new Error('Graph subscription registration returned no id/expirationDateTime.');
    }
    const historyCursor = await this.fetchCurrentHistoryCursor(accessToken);
    return { providerWatchId: body.id, historyCursor, expiresAt: new Date(body.expirationDateTime) };
  }

  async renewWatch(accessToken: string, _mailboxUserEmail: string, existingProviderWatchId: string | null): Promise<RegisterWatchResult> {
    if (!existingProviderWatchId) {
      return this.registerWatch(accessToken, _mailboxUserEmail);
    }
    const expirationDateTime = new Date(Date.now() + SUBSCRIPTION_LIFETIME_MS).toISOString();
    const response = await fetch(`${GRAPH_BASE}/subscriptions/${existingProviderWatchId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expirationDateTime }),
    });
    if (!response.ok) {
      // The subscription may have already expired/been deleted provider-side — fall back to a
      // fresh registration rather than failing renewal outright.
      this.logger.warn(`Graph subscription renewal (PATCH) failed with HTTP ${response.status}; registering a new subscription instead.`);
      return this.registerWatch(accessToken, _mailboxUserEmail);
    }
    const body = (await response.json().catch(() => ({}))) as GraphSubscriptionResponse;
    const historyCursor = await this.fetchCurrentHistoryCursor(accessToken);
    return { providerWatchId: body.id ?? existingProviderWatchId, historyCursor, expiresAt: new Date(body.expirationDateTime ?? expirationDateTime) };
  }

  async stopWatch(accessToken: string, providerWatchId: string | null): Promise<void> {
    if (!providerWatchId) return;
    try {
      await fetch(`${GRAPH_BASE}/subscriptions/${providerWatchId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
    } catch (error) {
      this.logger.warn(`Graph subscription deletion failed (treated as best-effort): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async fetchChangedMessages(accessToken: string, sinceHistoryCursor: string): Promise<FetchChangesResult> {
    const response = await fetch(sinceHistoryCursor, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (response.status === 410) {
      // Graph's documented "resync required" signal for an expired/invalid delta token.
      return { changedMessages: [], newHistoryCursor: sinceHistoryCursor, cursorTooOld: true };
    }
    if (!response.ok) {
      throw new Error(`Graph delta query failed: HTTP ${response.status}`);
    }
    const body = (await response.json().catch(() => ({}))) as GraphDeltaResponse;
    const changedMessages: ChangedMessageRef[] = (body.value ?? [])
      .filter((m) => m.id && !m['@removed'])
      .map((m) => ({ providerMessageId: m.id!, providerThreadId: m.conversationId ?? null }));

    const newCursor = body['@odata.deltaLink'] ?? body['@odata.nextLink'] ?? sinceHistoryCursor;
    return { changedMessages, newHistoryCursor: newCursor, cursorTooOld: false };
  }

  async fetchMessageMetadata(accessToken: string, providerMessageId: string): Promise<ProviderInboxMessageMetadata> {
    const url = new URL(`${GRAPH_BASE}/me/messages/${providerMessageId}`);
    url.searchParams.set('$select', 'id,conversationId,internetMessageId,internetMessageHeaders,from,toRecipients,subject,receivedDateTime,hasAttachments,size');

    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
      throw new Error(`Graph message metadata fetch failed: HTTP ${response.status}`);
    }
    const body = (await response.json().catch(() => ({}))) as GraphMessageResponse;
    return this.toMetadata(body);
  }

  async fetchMessageContent(accessToken: string, providerMessageId: string): Promise<ProviderInboxMessageContent> {
    const url = new URL(`${GRAPH_BASE}/me/messages/${providerMessageId}`);
    url.searchParams.set('$select', 'id,conversationId,internetMessageId,internetMessageHeaders,from,toRecipients,subject,receivedDateTime,body,hasAttachments,size');

    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
      throw new Error(`Graph message content fetch failed: HTTP ${response.status}`);
    }
    const body = (await response.json().catch(() => ({}))) as GraphMessageResponse;
    const metadata = this.toMetadata(body);
    const isHtml = body.body?.contentType?.toLowerCase() === 'html';

    let attachmentMetadata: Array<{ fileName: string; mimeType: string; sizeBytes: number }> = [];
    if (body.hasAttachments) {
      attachmentMetadata = await this.fetchAttachmentMetadata(accessToken, providerMessageId);
    }

    return {
      metadata,
      plainTextBody: isHtml ? null : (body.body?.content ?? null),
      htmlBody: isHtml ? (body.body?.content ?? null) : null,
      hasCalendarInvite: attachmentMetadata.some((a) => a.mimeType === 'text/calendar' || a.fileName.endsWith('.ics')),
      attachmentMetadata,
    };
  }

  private async fetchAttachmentMetadata(accessToken: string, providerMessageId: string): Promise<Array<{ fileName: string; mimeType: string; sizeBytes: number }>> {
    const url = new URL(`${GRAPH_BASE}/me/messages/${providerMessageId}/attachments`);
    url.searchParams.set('$select', 'name,contentType,size');
    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) return [];
    const body = (await response.json().catch(() => ({}))) as GraphAttachmentListResponse;
    return (body.value ?? []).map((a) => ({ fileName: a.name ?? 'attachment', mimeType: a.contentType ?? 'application/octet-stream', sizeBytes: a.size ?? 0 }));
  }

  async fetchCurrentHistoryCursor(accessToken: string): Promise<string> {
    // A delta query with no prior token returns the first page plus, after paging fully through,
    // a deltaLink — for establishing the STARTING cursor we only need that deltaLink, so request
    // the smallest reasonable page and immediately consume any nextLink pages until deltaLink
    // appears (an inbox-reading upgrade is a one-time event, not a hot path).
    let url = `${GRAPH_BASE}/me/mailFolders('inbox')/messages/delta?$select=id`;
    // eslint-disable-next-line no-constant-condition -- bounded below by the deltaLink terminal condition on every real Graph response
    while (true) {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) {
        throw new Error(`Graph initial delta fetch failed: HTTP ${response.status}`);
      }
      const body = (await response.json().catch(() => ({}))) as GraphDeltaResponse;
      if (body['@odata.deltaLink']) return body['@odata.deltaLink'];
      if (body['@odata.nextLink']) {
        url = body['@odata.nextLink'];
        continue;
      }
      throw new Error('Graph delta response had neither a deltaLink nor a nextLink.');
    }
  }

  async checkInboxCapabilityHealth(accessToken: string): Promise<{ readonly healthy: boolean; readonly detail: string }> {
    try {
      const response = await fetch(`${GRAPH_BASE}/me/mailFolders('inbox')`, { headers: { Authorization: `Bearer ${accessToken}` } });
      return response.ok ? { healthy: true, detail: 'Graph inbox folder reachable with the current access token.' } : { healthy: false, detail: `Graph inbox folder check returned HTTP ${response.status}.` };
    } catch (error) {
      return { healthy: false, detail: `Graph inbox health check failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  detectThrottling(httpStatus: number, retryAfterHeader: string | null): ThrottleInfo {
    if (httpStatus !== 429) return { throttled: false, retryAfterMs: null };
    return { throttled: true, retryAfterMs: retryAfterHeader ? Number(retryAfterHeader) * 1000 : 30_000 };
  }

  private toMetadata(body: GraphMessageResponse): ProviderInboxMessageMetadata {
    return {
      providerMessageId: body.id ?? '',
      providerThreadId: body.conversationId ?? null,
      rfcMessageId: body.internetMessageId ?? null,
      inReplyTo: headerValue(body.internetMessageHeaders, 'In-Reply-To'),
      referencesHeaders: parseReferences(headerValue(body.internetMessageHeaders, 'References')),
      fromAddress: body.from?.emailAddress?.address ?? '',
      fromDisplayName: body.from?.emailAddress?.name ?? null,
      toAddresses: (body.toRecipients ?? []).map((r) => r.emailAddress?.address ?? '').filter(Boolean),
      subject: body.subject ?? '',
      receivedAt: body.receivedDateTime ? new Date(body.receivedDateTime) : new Date(),
      sizeEstimateBytes: body.size ?? 0,
      isAutoReplyHeaderPresent: headerValue(body.internetMessageHeaders, 'X-Auto-Response-Suppress') !== null || headerValue(body.internetMessageHeaders, 'Auto-Submitted') !== null,
      isDeliveryFailureHeaderPresent: (body.subject ?? '').toLowerCase().startsWith('undeliverable:'),
    };
  }
}
