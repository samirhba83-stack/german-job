import { EmailEventType } from '../models/email-message';

export interface RecordEmailEventInput {
  readonly emailMessageId: string;
  readonly eventType: EmailEventType;
  readonly providerId: string | null;
  readonly detail: string | null;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface EmailEventRecord {
  readonly id: string;
  readonly emailMessageId: string;
  readonly eventType: EmailEventType;
  readonly providerId: string | null;
  readonly detail: string | null;
  readonly metadata: Readonly<Record<string, string>>;
  readonly occurredAt: Date;
}

export const EMAIL_EVENT_REPOSITORY = Symbol('EMAIL_EVENT_REPOSITORY');

/** The immutable, append-only history behind "track every email" (M28) — mirrors
 * `ExecutionEventRecorder`'s own port/token pattern and never-update/never-delete doctrine for
 * this bounded context specifically. */
export interface EmailEventRepository {
  record(input: RecordEmailEventInput, now: Date): Promise<EmailEventRecord>;
  listForMessage(emailMessageId: string): Promise<EmailEventRecord[]>;
}
