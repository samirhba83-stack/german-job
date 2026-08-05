import { ReplyDraftRecord, CreateReplyDraftInput, ReplyDraftUpdatePatch } from '../models/reply-draft';

export const REPLY_DRAFT_REPOSITORY = Symbol('REPLY_DRAFT_REPOSITORY');

export interface ReplyDraftRepository {
  findById(id: string): Promise<ReplyDraftRecord | null>;
  create(input: CreateReplyDraftInput, now: Date): Promise<ReplyDraftRecord>;
  update(id: string, patch: ReplyDraftUpdatePatch, now: Date): Promise<ReplyDraftRecord>;
  listByInboxMessageId(inboxMessageId: string): Promise<ReplyDraftRecord[]>;
}
