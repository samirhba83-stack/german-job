import { Injectable } from '@nestjs/common';
import type { Notification as PrismaNotification, NotificationPreference as PrismaNotificationPreference, Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { NotificationRepository, NotificationPreferenceRepository } from '../../domain/ports/notification.repository';
import { NotificationRecord, CreateNotificationInput, NotificationKind, NotificationPreferenceRecord } from '../../domain/models/notification';

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Real DB-level dedup: a repeat call for the same `(userId, dedupeKey)` hits the unique
   * constraint; caught here and treated as "already exists," matching M28's `EmailQueueRepository
   * .enqueue()`/M28.6's `ConnectedMailboxSendAttemptRepository.reserve()` upsert-idempotency
   * precedent, just via upsert directly rather than a catch (Prisma's `upsert` is race-safe). */
  async createIfNotDuplicate(input: CreateNotificationInput, now: Date): Promise<{ readonly notification: NotificationRecord; readonly wasNewlyCreated: boolean }> {
    const existing = await this.prisma.notification.findUnique({ where: { userId_dedupeKey: { userId: input.userId, dedupeKey: input.dedupeKey } } });
    if (existing) {
      return { notification: this.toRecord(existing), wasNewlyCreated: false };
    }
    try {
      const created = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          kind: input.kind as unknown as Prisma.NotificationCreateInput['kind'],
          relatedInboxMessageId: input.relatedInboxMessageId,
          relatedApplicationId: input.relatedApplicationId,
          title: input.title,
          body: input.body,
          dedupeKey: input.dedupeKey,
          createdAt: now,
        },
      });
      return { notification: this.toRecord(created), wasNewlyCreated: true };
    } catch (error) {
      // A genuine concurrent race lost to another request that inserted the same
      // (userId, dedupeKey) between our existence check and our insert — re-fetch and return it.
      const raced = await this.prisma.notification.findUnique({ where: { userId_dedupeKey: { userId: input.userId, dedupeKey: input.dedupeKey } } });
      if (raced) return { notification: this.toRecord(raced), wasNewlyCreated: false };
      throw error;
    }
  }

  async listByUserId(userId: string, limit: number, offset: number): Promise<NotificationRecord[]> {
    const rows = await this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit, skip: offset });
    return rows.map((row) => this.toRecord(row));
  }

  async markRead(id: string, now: Date): Promise<void> {
    await this.prisma.notification.update({ where: { id }, data: { readAt: now } });
  }

  private toRecord(row: PrismaNotification): NotificationRecord {
    return {
      id: row.id,
      userId: row.userId,
      kind: row.kind as unknown as NotificationKind,
      relatedInboxMessageId: row.relatedInboxMessageId,
      relatedApplicationId: row.relatedApplicationId,
      title: row.title,
      body: row.body,
      dedupeKey: row.dedupeKey,
      readAt: row.readAt,
      createdAt: row.createdAt,
    };
  }
}

@Injectable()
export class PrismaNotificationPreferenceRepository implements NotificationPreferenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<NotificationPreferenceRecord | null> {
    const row = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    return row ? this.toRecord(row) : null;
  }

  async upsert(userId: string, patch: Partial<Omit<NotificationPreferenceRecord, 'userId'>>): Promise<NotificationPreferenceRecord> {
    const row = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...patch },
      update: { ...patch },
    });
    return this.toRecord(row);
  }

  private toRecord(row: PrismaNotificationPreference): NotificationPreferenceRecord {
    return {
      userId: row.userId,
      interviewInvitationEnabled: row.interviewInvitationEnabled,
      offerOrAcceptanceEnabled: row.offerOrAcceptanceEnabled,
      rejectionEnabled: row.rejectionEnabled,
      documentsRequestedEnabled: row.documentsRequestedEnabled,
      deadlineApproachingEnabled: row.deadlineApproachingEnabled,
      assessmentInvitationEnabled: row.assessmentInvitationEnabled,
      inboxConnectionIssuesEnabled: row.inboxConnectionIssuesEnabled,
      ambiguousReplyReviewEnabled: row.ambiguousReplyReviewEnabled,
      followUpControlChangedEnabled: row.followUpControlChangedEnabled,
      taskDeadlineEnabled: row.taskDeadlineEnabled,
      transitionExecutionFailedEnabled: row.transitionExecutionFailedEnabled,
    };
  }
}
