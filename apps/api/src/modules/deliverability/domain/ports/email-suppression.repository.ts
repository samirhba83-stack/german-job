import { EmailSuppressionReason } from '../models/email-message';

export interface EmailSuppressionEntryRecord {
  readonly id: string;
  readonly emailAddress: string;
  readonly reason: EmailSuppressionReason;
  readonly source: string;
  readonly note: string | null;
  readonly createdAt: Date;
}

export const EMAIL_SUPPRESSION_REPOSITORY = Symbol('EMAIL_SUPPRESSION_REPOSITORY');

/** The real, load-bearing "never send here again" list (M28 Deliverability) — checked before
 * every enqueue, never bypassed regardless of priority. */
export interface EmailSuppressionRepository {
  isSuppressed(emailAddress: string): Promise<boolean>;
  /** Idempotent — suppressing an already-suppressed address is a safe no-op (returns the existing
   * entry), never a duplicate-key error, since a hard bounce or complaint can legitimately arrive
   * more than once for the same address. */
  suppress(emailAddress: string, reason: EmailSuppressionReason, source: string, note: string | null, now: Date): Promise<EmailSuppressionEntryRecord>;
  remove(emailAddress: string): Promise<void>;
  list(limit: number, offset: number): Promise<EmailSuppressionEntryRecord[]>;
  count(): Promise<number>;
}
