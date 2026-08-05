import { randomUUID } from 'node:crypto';

export interface MimeAttachmentInput {
  readonly fileName: string;
  readonly mimeType: string;
  readonly content: Buffer;
}

export interface MimeMessageParams {
  readonly fromDisplayName: string;
  readonly fromEmailAddress: string;
  readonly toEmailAddress: string;
  readonly replyToEmailAddress: string | null;
  readonly subject: string;
  readonly plainTextBody: string | null;
  readonly htmlBody: string | null;
  readonly attachments: ReadonlyArray<MimeAttachmentInput>;
  /** M29 — an optional, caller-supplied RFC 5322 `Message-ID` header value (including the
   * surrounding `<...>`). Omitted by every existing caller (SES/M28.5), preserving their exact
   * prior output; `GmailMailboxProviderAdapter` (M29) passes one so the resulting sent message's
   * real Message-ID is known without a follow-up API call, for reply correlation. */
  readonly messageIdHeader?: string;
}

/** Strips CR/LF and other control characters from any value destined for a MIME header —
 * real, necessary header-injection defense (Phase 7 "Prevent header injection"): without this, a
 * subject or filename containing `\r\nBcc: attacker@evil.example` could inject an entirely new
 * header into the raw message this application hands to SES. */
// eslint-disable-next-line no-control-regex -- intentional: matches CR/LF and other C0 control characters as a real header-injection defense.
const HEADER_UNSAFE_CHARS_PATTERN = /[\r\n\x00-\x08\x0b\x0c\x0e-\x1f]/g;

function sanitizeHeaderValue(value: string): string {
  return value.replace(HEADER_UNSAFE_CHARS_PATTERN, ' ').trim();
}

/** RFC 2045 requires base64 body content wrapped at 76 characters per line. */
function encodeBase64Wrapped(content: Buffer): string {
  const base64 = content.toString('base64');
  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += 76) {
    lines.push(base64.slice(i, i + 76));
  }
  return lines.join('\r\n');
}

/**
 * M28.5 — a real, hand-built MIME `multipart/mixed` message for `SesEmailProviderAdapter`'s
 * `SendRawEmailCommand` path. SES's simpler `SendEmailCommand` has no attachment support at all,
 * so real attachment delivery through SES requires constructing the raw message ourselves —
 * exactly the "official AWS-supported path" for this (`SendRawEmailCommand` is a first-class SES
 * API, not a workaround). Every header value is sanitized against CRLF injection; text bodies are
 * base64-encoded (never embedded raw, avoiding any need to escape MIME boundary collisions in
 * arbitrary candidate-authored content).
 */
export function buildRawMimeEmail(params: MimeMessageParams): Buffer {
  const boundary = `----=_JobEngine_${randomUUID()}`;
  const altBoundary = `----=_JobEngineAlt_${randomUUID()}`;

  const headerLines = [
    `From: ${sanitizeHeaderValue(params.fromDisplayName)} <${sanitizeHeaderValue(params.fromEmailAddress)}>`,
    `To: ${sanitizeHeaderValue(params.toEmailAddress)}`,
    params.replyToEmailAddress ? `Reply-To: ${sanitizeHeaderValue(params.replyToEmailAddress)}` : null,
    `Subject: ${sanitizeHeaderValue(params.subject)}`,
    params.messageIdHeader ? `Message-ID: ${sanitizeHeaderValue(params.messageIdHeader)}` : null,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter((line): line is string => line !== null);

  const bodyLines: string[] = [];

  if (params.plainTextBody && params.htmlBody) {
    bodyLines.push(
      `--${boundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      '',
      `--${altBoundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      encodeBase64Wrapped(Buffer.from(params.plainTextBody, 'utf8')),
      `--${altBoundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      encodeBase64Wrapped(Buffer.from(params.htmlBody, 'utf8')),
      `--${altBoundary}--`,
      '',
    );
  } else {
    const body = params.htmlBody ?? params.plainTextBody ?? '';
    const contentType = params.htmlBody ? 'text/html' : 'text/plain';
    bodyLines.push(`--${boundary}`, `Content-Type: ${contentType}; charset="UTF-8"`, 'Content-Transfer-Encoding: base64', '', encodeBase64Wrapped(Buffer.from(body, 'utf8')), '');
  }

  for (const attachment of params.attachments) {
    const safeName = sanitizeHeaderValue(attachment.fileName);
    bodyLines.push(
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}; name="${safeName}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${safeName}"`,
      '',
      encodeBase64Wrapped(attachment.content),
      '',
    );
  }

  bodyLines.push(`--${boundary}--`, '');

  return Buffer.from([...headerLines, '', ...bodyLines].join('\r\n'), 'utf8');
}
