import { SenderIdentity } from '../../../email-provider/domain/models/sender-identity';
import { EmailAttachmentSpec } from '../../../email-provider/domain/models/email-attachment';

/** Domain-level mirrors of the Prisma enums — kept as plain TS unions here rather than importing
 * `@german-job-engine/database` types into the domain layer, matching this codebase's established
 * precedent (`execution-tracking`'s `ExecutionEventType`, billing's `PlanCode`/`SubscriptionStatus`):
 * the domain layer never depends on the persistence layer's generated types; the Prisma repository
 * is the one deliberate crossing point that casts between them. */
export type EmailPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export type EmailMessageStatus =
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'DEFERRED'
  | 'BOUNCED'
  | 'COMPLAINED'
  | 'FAILED'
  | 'DEAD_LETTER'
  | 'SUPPRESSED';

export type EmailEventType =
  | 'QUEUED'
  | 'SENDING_STARTED'
  | 'PROVIDER_SELECTED'
  | 'PROVIDER_FAILOVER'
  | 'SENT'
  | 'DELIVERED'
  | 'DEFERRED'
  | 'BOUNCED_SOFT'
  | 'BOUNCED_HARD'
  | 'COMPLAINED'
  | 'OPENED'
  | 'CLICKED'
  | 'RETRY_SCHEDULED'
  | 'FAILED'
  | 'DEAD_LETTERED'
  | 'SUPPRESSED_SKIP';

export type EmailSuppressionReason = 'HARD_BOUNCE' | 'COMPLAINT' | 'MANUAL' | 'UNSUBSCRIBE';

/** M28.5 — one entry of the frozen, immutable attachment snapshot (Phase 6). Written once at
 * enqueue time onto `EmailMessage.attachmentRefs`; never touched again, including across retries
 * of the same row — see the M28.5 report's "Immutable Delivery Snapshot" design note. Currently a
 * real, DB-ready, populated-when-supplied field — no current caller of `EmailQueueService.enqueue()`
 * builds a request with real attachments yet (the live campaign-dispatch path sends synchronously
 * via `EmailProviderManagerService` rather than through this queue — see the M28.5 report's
 * Known Limitations for the resulting cross-retry snapshot gap on that specific path). */
export interface FrozenAttachmentRef {
  readonly documentId: string;
  readonly version: number;
  readonly checksumSha256: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

/** The queue's own durable record — one row per logical email, regardless of how many provider
 * attempts it takes. */
export interface EmailMessageRecord {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly priority: EmailPriority;
  readonly status: EmailMessageStatus;
  readonly senderName: string;
  readonly senderEmail: string;
  readonly recipientEmail: string;
  readonly subject: string;
  readonly plainTextBody: string | null;
  readonly htmlBody: string | null;
  readonly attachmentsMeta: ReadonlyArray<EmailAttachmentSpec>;
  readonly attachmentRefs: ReadonlyArray<FrozenAttachmentRef>;
  readonly senderIdentityId: string | null;
  readonly providerId: string | null;
  readonly providerMessageId: string | null;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly nextAttemptAt: Date | null;
  readonly lastFailureReason: string | null;
  readonly correlationId: string | null;
  readonly traceId: string | null;
  readonly campaignId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface EnqueueEmailInput {
  readonly idempotencyKey: string;
  readonly priority: EmailPriority;
  readonly sender: SenderIdentity;
  readonly recipientEmail: string;
  readonly subject: string;
  readonly plainTextBody: string | null;
  readonly htmlBody: string | null;
  readonly attachments: ReadonlyArray<EmailAttachmentSpec>;
  /** Optional — a caller that has already resolved real attachments to a frozen snapshot (M28.5
   * Phase 6) supplies this; omitted entirely by every current caller (see this file's own doc
   * comment on `FrozenAttachmentRef`). */
  readonly attachmentRefs?: ReadonlyArray<FrozenAttachmentRef>;
  readonly senderIdentityId?: string | null;
  readonly maxAttempts: number;
  readonly correlationId: string | null;
  readonly traceId: string | null;
  readonly campaignId: string | null;
}
