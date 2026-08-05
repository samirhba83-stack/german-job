import { ProviderInboxMessageContent } from '../models/provider-inbox-message';
import { NormalizedInboxMessage } from '../models/normalized-message';

const MAX_BODY_LENGTH = 20_000; // a bound before anything (rules or a future AI call) ever sees it

/** Matches a "quoted prior message" boundary — the point past which content is the OTHER party's
 * earlier message being echoed back, not this message's own new content (Phase 8: "do not treat
 * quoted previous emails as new reply content"). Covers the common English/German mail-client
 * quote-header formats and a run of `>`-prefixed lines. The German branch allows up to 80 chars
 * between "schrieb" and the trailing colon (matching the English branch's own permissiveness)
 * because real German mail clients put the sender's name/email there, e.g. `schrieb "Jane Doe"
 * <jane@example.com>:` — a narrower bound would never match a real message. */
const QUOTE_BOUNDARY_PATTERN =
  /(^|\n)(on .{5,80} wrote:|am .{5,80} schrieb.{0,80}:|-{2,} ?original message ?-{2,}|-{2,} ?urspr[uü]ngliche nachricht ?-{2,}|from: .{1,120}\nsent: |von: .{1,120}\ngesendet: )/i;
const QUOTED_LINE_RUN_PATTERN = /(\n>.*){3,}/;

const SIGNATURE_BOUNDARY_PATTERN = /(^|\n)(--\s*$|mit freundlichen gr[uü][ßs]en|best regards|kind regards|viele gr[uü][ßs]e)/i;

const OOO_BODY_PATTERN = /out of (the )?office|currently (unavailable|away)|abwesenheit|derzeit nicht im b[uü]ro|urlaub bis/i;
const GERMAN_MARKER_PATTERN = /\b(bewerbung|vorstellungsgespr[aä]ch|unterlagen|gesch[aä]tzte|sehr geehrte|freundlichen gr[uü][ßs]en)\b/i;
const ENGLISH_MARKER_PATTERN = /\b(application|interview|regards|dear|sincerely|thank you)\b/i;

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripQuotedAndSignature(body: string): string {
  const quoteBoundary = QUOTE_BOUNDARY_PATTERN.exec(body);
  const quotedRun = QUOTED_LINE_RUN_PATTERN.exec(body);
  let cutIndex = body.length;
  if (quoteBoundary) cutIndex = Math.min(cutIndex, quoteBoundary.index);
  if (quotedRun) cutIndex = Math.min(cutIndex, quotedRun.index);
  const withoutQuotes = body.slice(0, cutIndex);

  const signatureBoundary = SIGNATURE_BOUNDARY_PATTERN.exec(withoutQuotes);
  const withoutSignature = signatureBoundary ? withoutQuotes.slice(0, signatureBoundary.index) : withoutQuotes;
  return withoutSignature.trim();
}

function detectLanguage(text: string): 'DE' | 'EN' | 'UNKNOWN' {
  const germanHits = (text.match(GERMAN_MARKER_PATTERN) ?? []).length;
  const englishHits = (text.match(ENGLISH_MARKER_PATTERN) ?? []).length;
  if (germanHits === 0 && englishHits === 0) return 'UNKNOWN';
  return germanHits >= englishHits ? 'DE' : 'EN';
}

/**
 * M29 Phase 8 — the one place every provider message becomes the internal `NormalizedInboxMessage`
 * shape. A pure function (no I/O) so it's fully unit-testable in isolation. Original provider
 * identifiers pass through completely untouched (Phase 8: "do not destroy original provider
 * identifiers"); only the body is cleaned.
 */
export function normalizeProviderMessage(content: ProviderInboxMessageContent): NormalizedInboxMessage {
  const rawBody = content.htmlBody ? stripHtml(content.htmlBody) : (content.plainTextBody ?? '');
  const cleaned = stripQuotedAndSignature(rawBody).slice(0, MAX_BODY_LENGTH);
  const isOutOfOffice = content.metadata.isAutoReplyHeaderPresent && OOO_BODY_PATTERN.test(`${content.metadata.subject}\n${cleaned}`);

  return {
    providerMessageId: content.metadata.providerMessageId,
    providerThreadId: content.metadata.providerThreadId,
    rfcMessageId: content.metadata.rfcMessageId,
    inReplyTo: content.metadata.inReplyTo,
    referencesHeaders: content.metadata.referencesHeaders,
    fromAddress: content.metadata.fromAddress,
    toAddress: content.metadata.toAddresses[0] ?? '',
    subject: content.metadata.subject,
    receivedAt: content.metadata.receivedAt,
    candidateRelevantBody: cleaned,
    detectedLanguage: detectLanguage(`${content.metadata.subject}\n${cleaned}`),
    isAutoReply: content.metadata.isAutoReplyHeaderPresent,
    isDeliveryFailure: content.metadata.isDeliveryFailureHeaderPresent,
    isOutOfOffice,
    hasCalendarInvite: content.hasCalendarInvite,
    attachmentFileNames: content.attachmentMetadata.map((a) => a.fileName),
  };
}
