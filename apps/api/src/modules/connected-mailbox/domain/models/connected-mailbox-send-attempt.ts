import { ConnectedMailboxProvider } from './connected-mailbox';

export type ConnectedMailboxSendStatus = 'PENDING' | 'SENT' | 'FAILED' | 'BLOCKED';

/** One frozen entry of the attachment snapshot — mirrors M28.5's `FrozenAttachmentRef` shape
 * exactly, duplicated here (not imported) because `connected-mailbox` deliberately does not
 * depend on `deliverability` (Phase 11: keep mailbox credentials and platform-provider
 * credentials/modules isolated) — this is a small, plain data shape, not a behavioral coupling. */
export interface FrozenMailboxAttachmentRef {
  readonly documentId: string;
  readonly version: number;
  readonly checksumSha256: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

/** M28.6 Phase 12 — the immutable delivery snapshot for the connected-mailbox send path. Written
 * once at reservation time; `attachmentRefs`/`bodyChecksumSha256`/`recipientEmail`/`subject` are
 * never touched again, including across retries of the same row (`idempotencyKey @unique`). */
export interface ConnectedMailboxSendAttemptRecord {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly connectedMailboxId: string;
  readonly verifiedSenderEmail: string;
  readonly provider: ConnectedMailboxProvider;
  readonly providerAccountId: string;

  readonly applicationId: string | null;
  readonly campaignId: string | null;
  readonly recipientEmail: string;
  readonly subject: string;
  readonly bodyChecksumSha256: string;
  readonly attachmentRefs: ReadonlyArray<FrozenMailboxAttachmentRef>;

  readonly status: ConnectedMailboxSendStatus;
  readonly providerMessageId: string | null;
  readonly providerThreadId: string | null;
  /** M29 — the real RFC 5322 Message-ID this sent message carries, the strong signal
   * `ReplyCorrelationService` matches an incoming reply's In-Reply-To/References headers against. */
  readonly rfcMessageId: string | null;
  readonly attempts: number;
  readonly lastFailureCategory: string | null;
  readonly lastFailureReason: string | null;

  readonly correlationId: string | null;
  readonly traceId: string | null;

  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateConnectedMailboxSendAttemptInput {
  readonly idempotencyKey: string;
  readonly connectedMailboxId: string;
  readonly verifiedSenderEmail: string;
  readonly provider: ConnectedMailboxProvider;
  readonly providerAccountId: string;
  readonly applicationId: string | null;
  readonly campaignId: string | null;
  readonly recipientEmail: string;
  readonly subject: string;
  readonly bodyChecksumSha256: string;
  readonly attachmentRefs: ReadonlyArray<FrozenMailboxAttachmentRef>;
  readonly correlationId: string | null;
  readonly traceId: string | null;
}
