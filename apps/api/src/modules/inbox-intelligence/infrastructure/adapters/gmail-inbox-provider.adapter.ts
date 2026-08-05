import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectedInboxProviderPort, RegisterWatchResult, FetchChangesResult, ThrottleInfo } from '../../domain/ports/connected-inbox-provider.port';
import { ProviderInboxMessageMetadata, ProviderInboxMessageContent, ChangedMessageRef } from '../../domain/models/provider-inbox-message';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

interface GmailWatchResponse {
  historyId?: string;
  expiration?: string; // epoch millis as a string
}

interface GmailHistoryResponse {
  history?: Array<{ messagesAdded?: Array<{ message?: { id?: string; threadId?: string } }> }>;
  historyId?: string;
}

interface GmailHeader {
  name?: string;
  value?: string;
}

interface GmailMessagePart {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string };
  parts?: GmailMessagePart[];
}

interface GmailMessageResponse {
  id?: string;
  threadId?: string;
  sizeEstimate?: number;
  internalDate?: string;
  payload?: GmailMessagePart;
}

function headerValue(headers: GmailHeader[] | undefined, name: string): string | null {
  const found = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return found?.value ?? null;
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf8');
}

function findBodyByMimeType(part: GmailMessagePart | undefined, mimeType: string): string | null {
  if (!part) return null;
  if (part.mimeType === mimeType && part.body?.data) return decodeBase64Url(part.body.data);
  for (const child of part.parts ?? []) {
    const found = findBodyByMimeType(child, mimeType);
    if (found) return found;
  }
  return null;
}

function hasCalendarPart(part: GmailMessagePart | undefined): boolean {
  if (!part) return false;
  if (part.mimeType === 'text/calendar' || part.filename?.endsWith('.ics')) return true;
  return (part.parts ?? []).some(hasCalendarPart);
}

function collectAttachmentMetadata(part: GmailMessagePart | undefined): Array<{ fileName: string; mimeType: string; sizeBytes: number }> {
  if (!part) return [];
  const own = part.filename && part.filename.length > 0 ? [{ fileName: part.filename, mimeType: part.mimeType ?? 'application/octet-stream', sizeBytes: part.body?.size ?? 0 }] : [];
  return [...own, ...(part.parts ?? []).flatMap(collectAttachmentMetadata)];
}

function parseReferences(raw: string | null): string[] {
  return raw ? raw.split(/\s+/).filter(Boolean) : [];
}

/**
 * M29 Phase 4/5/8 — real Gmail API integration for inbox reading, hand-rolled REST (same
 * rationale as the M28.6 send adapter). Uses the real `users.watch`/`users.history.list`
 * mechanism (Gmail's own official push-notification design: `watch()` registers a Cloud Pub/Sub
 * topic, and every notification just means "call `history.list` since your last known
 * `historyId`" — the notification payload itself carries no message content). Never reuses the
 * M28.6 `GmailMailboxProviderAdapter` (send-only credentials, different port) — this is a
 * completely separate adapter bound to `ConnectedInboxProviderPort`.
 */
@Injectable()
export class GmailInboxProviderAdapter implements ConnectedInboxProviderPort {
  readonly provider = 'GOOGLE_GMAIL' as const;
  private readonly logger = new Logger(GmailInboxProviderAdapter.name);

  constructor(private readonly config: ConfigService) {}

  private get pubSubTopicName(): string {
    return this.config.get<string>('inboxIntelligence.google.pubSubTopicName', '');
  }

  async registerWatch(accessToken: string, _mailboxUserEmail: string): Promise<RegisterWatchResult> {
    const response = await fetch(`${GMAIL_BASE}/watch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicName: this.pubSubTopicName, labelIds: ['INBOX'] }),
    });
    if (!response.ok) {
      throw new Error(`Gmail watch registration failed: HTTP ${response.status}`);
    }
    const body = (await response.json().catch(() => ({}))) as GmailWatchResponse;
    if (!body.historyId || !body.expiration) {
      throw new Error('Gmail watch registration returned no historyId/expiration.');
    }
    return { providerWatchId: null, historyCursor: body.historyId, expiresAt: new Date(Number(body.expiration)) };
  }

  async renewWatch(accessToken: string, mailboxUserEmail: string, _existingProviderWatchId: string | null): Promise<RegisterWatchResult> {
    // Gmail has no separate "renew" call — re-calling watch() extends the expiration and is the
    // documented renewal mechanism (a watch expires after ~7 days and must simply be re-requested).
    return this.registerWatch(accessToken, mailboxUserEmail);
  }

  async stopWatch(accessToken: string, _providerWatchId: string | null): Promise<void> {
    try {
      await fetch(`${GMAIL_BASE}/stop`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
    } catch (error) {
      this.logger.warn(`Gmail stop-watch call failed (treated as best-effort): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async fetchChangedMessages(accessToken: string, sinceHistoryCursor: string): Promise<FetchChangesResult> {
    const url = new URL(`${GMAIL_BASE}/history`);
    url.searchParams.set('startHistoryId', sinceHistoryCursor);
    url.searchParams.set('historyTypes', 'messageAdded');
    url.searchParams.set('labelId', 'INBOX');

    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (response.status === 404) {
      // Gmail's own documented signal that the starting historyId is too old to resume from
      // (Phase 5: "gap detection... recovery polling after missed notifications").
      return { changedMessages: [], newHistoryCursor: sinceHistoryCursor, cursorTooOld: true };
    }
    if (!response.ok) {
      throw new Error(`Gmail history.list failed: HTTP ${response.status}`);
    }
    const body = (await response.json().catch(() => ({}))) as GmailHistoryResponse;
    const changedMessages: ChangedMessageRef[] = (body.history ?? [])
      .flatMap((entry) => entry.messagesAdded ?? [])
      .filter((added) => added.message?.id)
      .map((added) => ({ providerMessageId: added.message!.id!, providerThreadId: added.message!.threadId ?? null }));

    return { changedMessages, newHistoryCursor: body.historyId ?? sinceHistoryCursor, cursorTooOld: false };
  }

  async fetchMessageMetadata(accessToken: string, providerMessageId: string): Promise<ProviderInboxMessageMetadata> {
    const url = new URL(`${GMAIL_BASE}/messages/${providerMessageId}`);
    url.searchParams.set('format', 'metadata');
    ['Message-ID', 'In-Reply-To', 'References', 'From', 'To', 'Subject', 'Date', 'Auto-Submitted', 'X-Autoreply', 'X-Failed-Recipients'].forEach((h) =>
      url.searchParams.append('metadataHeaders', h),
    );

    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
      throw new Error(`Gmail messages.get (metadata) failed: HTTP ${response.status}`);
    }
    const body = (await response.json().catch(() => ({}))) as GmailMessageResponse;
    return this.toMetadata(body);
  }

  async fetchMessageContent(accessToken: string, providerMessageId: string): Promise<ProviderInboxMessageContent> {
    const url = new URL(`${GMAIL_BASE}/messages/${providerMessageId}`);
    url.searchParams.set('format', 'full');

    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
      throw new Error(`Gmail messages.get (full) failed: HTTP ${response.status}`);
    }
    const body = (await response.json().catch(() => ({}))) as GmailMessageResponse;
    const metadata = this.toMetadata(body);

    return {
      metadata,
      plainTextBody: findBodyByMimeType(body.payload, 'text/plain'),
      htmlBody: findBodyByMimeType(body.payload, 'text/html'),
      hasCalendarInvite: hasCalendarPart(body.payload),
      attachmentMetadata: collectAttachmentMetadata(body.payload),
    };
  }

  async fetchCurrentHistoryCursor(accessToken: string): Promise<string> {
    const response = await fetch(`${GMAIL_BASE}/profile`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
      throw new Error(`Gmail profile fetch failed: HTTP ${response.status}`);
    }
    const body = (await response.json().catch(() => ({}))) as { historyId?: string };
    if (!body.historyId) {
      throw new Error('Gmail profile response had no historyId.');
    }
    return body.historyId;
  }

  async checkInboxCapabilityHealth(accessToken: string): Promise<{ readonly healthy: boolean; readonly detail: string }> {
    try {
      const response = await fetch(`${GMAIL_BASE}/profile`, { headers: { Authorization: `Bearer ${accessToken}` } });
      return response.ok ? { healthy: true, detail: 'Gmail inbox API reachable with the current access token.' } : { healthy: false, detail: `Gmail profile check returned HTTP ${response.status}.` };
    } catch (error) {
      return { healthy: false, detail: `Gmail inbox health check failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  detectThrottling(httpStatus: number, retryAfterHeader: string | null): ThrottleInfo {
    if (httpStatus !== 429 && httpStatus !== 403) return { throttled: false, retryAfterMs: null };
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 30_000;
    return { throttled: true, retryAfterMs };
  }

  private toMetadata(body: GmailMessageResponse): ProviderInboxMessageMetadata {
    const headers = body.payload?.headers;
    const fromRaw = headerValue(headers, 'From') ?? '';
    const fromEmailMatch = /<(.+)>/.exec(fromRaw);
    return {
      providerMessageId: body.id ?? '',
      providerThreadId: body.threadId ?? null,
      rfcMessageId: headerValue(headers, 'Message-ID'),
      inReplyTo: headerValue(headers, 'In-Reply-To'),
      referencesHeaders: parseReferences(headerValue(headers, 'References')),
      fromAddress: fromEmailMatch ? fromEmailMatch[1] : fromRaw,
      fromDisplayName: fromRaw.replace(/<.+>/, '').trim() || null,
      toAddresses: (headerValue(headers, 'To') ?? '').split(',').map((a) => a.trim()).filter(Boolean),
      subject: headerValue(headers, 'Subject') ?? '',
      receivedAt: body.internalDate ? new Date(Number(body.internalDate)) : new Date(),
      sizeEstimateBytes: body.sizeEstimate ?? 0,
      isAutoReplyHeaderPresent: headerValue(headers, 'Auto-Submitted') !== null || headerValue(headers, 'X-Autoreply') !== null,
      isDeliveryFailureHeaderPresent: headerValue(headers, 'X-Failed-Recipients') !== null,
    };
  }
}
