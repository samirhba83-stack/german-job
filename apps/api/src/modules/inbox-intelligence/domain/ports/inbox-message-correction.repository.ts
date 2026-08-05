import { InboxMessageCorrectionRecord, CreateInboxMessageCorrectionInput } from '../models/inbox-message-correction';

export const INBOX_MESSAGE_CORRECTION_REPOSITORY = Symbol('INBOX_MESSAGE_CORRECTION_REPOSITORY');

export interface InboxMessageCorrectionRepository {
  create(input: CreateInboxMessageCorrectionInput, now: Date): Promise<InboxMessageCorrectionRecord>;
  listByInboxMessageId(inboxMessageId: string): Promise<InboxMessageCorrectionRecord[]>;
}
