import { EmailSecurityAuditEventType } from '../models/email-security-audit-event';

export const EMAIL_SECURITY_AUDIT_REPOSITORY = Symbol('EMAIL_SECURITY_AUDIT_REPOSITORY');

export interface RecordEmailSecurityAuditEventInput {
  readonly eventType: EmailSecurityAuditEventType;
  readonly documentId?: string | null;
  readonly emailMessageId?: string | null;
  readonly senderIdentityId?: string | null;
  readonly connectedMailboxId?: string | null;
  readonly inboxMessageId?: string | null;
  readonly userId?: string | null;
  readonly applicationId?: string | null;
  readonly campaignId?: string | null;
  readonly detail?: string | null;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface EmailSecurityAuditEventRecord extends Required<Omit<RecordEmailSecurityAuditEventInput, 'metadata'>> {
  readonly id: string;
  readonly metadata: Readonly<Record<string, string>>;
  readonly occurredAt: Date;
}

export interface EmailSecurityAuditEventFilter {
  readonly eventType?: EmailSecurityAuditEventType;
  readonly documentId?: string;
  readonly connectedMailboxId?: string;
  readonly inboxMessageId?: string;
  readonly userId?: string;
}

/** Immutable, append-only — deliberately independent of `EmailEvent` (M28), since attachment/
 * sender/domain-readiness decisions happen on both the live synchronous campaign-dispatch path
 * (which never creates an `EmailMessage` row) and the queued path. Never accepts file contents in
 * `metadata`/`detail` — Non-Negotiable Principle #9/#12. */
export interface EmailSecurityAuditRepository {
  record(input: RecordEmailSecurityAuditEventInput, now: Date): Promise<void>;
  /** Admin Operations' "inspect blocked attachment deliveries" / general audit inspection —
   * filter by `eventType: 'ATTACHMENT_REJECTED'` for the former. */
  list(filter: EmailSecurityAuditEventFilter, limit: number, offset: number): Promise<EmailSecurityAuditEventRecord[]>;
}
