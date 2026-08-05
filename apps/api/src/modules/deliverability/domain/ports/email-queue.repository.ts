import { EmailMessageRecord, EmailMessageStatus, EnqueueEmailInput } from '../models/email-message';

export const EMAIL_QUEUE_REPOSITORY = Symbol('EMAIL_QUEUE_REPOSITORY');

export interface EmailQueueRepository {
  /** `idempotencyKey` is `@unique` at the DB level — a caller retrying the same enqueue call
   * (network retry, at-least-once delivery from an upstream system) gets back the *existing* row
   * rather than a duplicate (M28 "Duplicate protection"). */
  enqueue(input: EnqueueEmailInput, now: Date): Promise<EmailMessageRecord>;
  findByIdempotencyKey(key: string): Promise<EmailMessageRecord | null>;
  findById(id: string): Promise<EmailMessageRecord | null>;
  findByProviderMessageId(providerId: string, providerMessageId: string): Promise<EmailMessageRecord | null>;

  /** Atomically claims up to `limit` ready messages (QUEUED, or DEFERRED with `nextAttemptAt <=
   * now`), highest priority and oldest first, transitioning each claimed row to SENDING and
   * incrementing `attempts`. Only rows this exact call wins the claim race for are returned —
   * safe under concurrent workers/instances, via the same conditional-`updateMany`
   * (zero-rows-affected-means-lost-the-race) idiom `PostgresLeaseLock` already established. */
  claimBatch(limit: number, now: Date): Promise<EmailMessageRecord[]>;

  markSent(id: string, providerId: string, providerMessageId: string | null, now: Date): Promise<void>;
  markDeferredForRetry(id: string, reason: string, nextAttemptAt: Date, now: Date): Promise<void>;
  markDeadLetter(id: string, reason: string, now: Date): Promise<void>;
  markSuppressed(id: string, now: Date): Promise<void>;
  /** Webhook-driven terminal/near-terminal status transitions (DELIVERED/BOUNCED/COMPLAINED) —
   * distinct from the send-attempt transitions above, since these arrive asynchronously, later,
   * from the provider's own event webhook rather than from this application's own send attempt. */
  applyProviderStatus(id: string, status: EmailMessageStatus, now: Date): Promise<void>;

  listByStatus(status: EmailMessageStatus, limit: number, offset: number): Promise<EmailMessageRecord[]>;
  countByStatus(): Promise<Readonly<Record<string, number>>>;
}
