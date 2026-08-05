import { Injectable } from '@nestjs/common';
import type { ReplyDraft as PrismaReplyDraft, Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { ReplyDraftRepository } from '../../domain/ports/reply-draft.repository';
import { ReplyDraftRecord, CreateReplyDraftInput, ReplyDraftUpdatePatch, ReplyDraftType, ReplyDraftStatus, ReplyDraftPlaceholder } from '../../domain/models/reply-draft';

@Injectable()
export class PrismaReplyDraftRepository implements ReplyDraftRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ReplyDraftRecord | null> {
    const row = await this.prisma.replyDraft.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async create(input: CreateReplyDraftInput, now: Date): Promise<ReplyDraftRecord> {
    const row = await this.prisma.replyDraft.create({
      data: {
        inboxMessageId: input.inboxMessageId,
        applicationId: input.applicationId,
        connectedMailboxId: input.connectedMailboxId,
        draftType: input.draftType as unknown as Prisma.ReplyDraftCreateInput['draftType'],
        subject: input.subject,
        bodyText: input.bodyText,
        placeholders: input.placeholders as unknown as Prisma.InputJsonValue,
        status: 'DRAFT',
        createdAt: now,
        updatedAt: now,
      },
    });
    return this.toRecord(row);
  }

  async update(id: string, patch: ReplyDraftUpdatePatch, now: Date): Promise<ReplyDraftRecord> {
    const row = await this.prisma.replyDraft.update({
      where: { id },
      data: {
        ...(patch.subject !== undefined ? { subject: patch.subject } : {}),
        ...(patch.bodyText !== undefined ? { bodyText: patch.bodyText } : {}),
        ...(patch.placeholders !== undefined ? { placeholders: patch.placeholders as unknown as Prisma.InputJsonValue } : {}),
        ...(patch.status !== undefined ? { status: patch.status as unknown as Prisma.ReplyDraftUpdateInput['status'] } : {}),
        ...(patch.approvedByUserId !== undefined ? { approvedByUserId: patch.approvedByUserId } : {}),
        ...(patch.approvedAt !== undefined ? { approvedAt: patch.approvedAt } : {}),
        ...(patch.sentConnectedMailboxSendAttemptId !== undefined ? { sentConnectedMailboxSendAttemptId: patch.sentConnectedMailboxSendAttemptId } : {}),
        updatedAt: now,
      },
    });
    return this.toRecord(row);
  }

  async listByInboxMessageId(inboxMessageId: string): Promise<ReplyDraftRecord[]> {
    const rows = await this.prisma.replyDraft.findMany({ where: { inboxMessageId }, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: PrismaReplyDraft): ReplyDraftRecord {
    return {
      id: row.id,
      inboxMessageId: row.inboxMessageId,
      applicationId: row.applicationId,
      connectedMailboxId: row.connectedMailboxId,
      draftType: row.draftType as unknown as ReplyDraftType,
      subject: row.subject,
      bodyText: row.bodyText,
      placeholders: (row.placeholders as unknown as ReplyDraftPlaceholder[]) ?? [],
      status: row.status as unknown as ReplyDraftStatus,
      approvedByUserId: row.approvedByUserId,
      approvedAt: row.approvedAt,
      sentConnectedMailboxSendAttemptId: row.sentConnectedMailboxSendAttemptId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
