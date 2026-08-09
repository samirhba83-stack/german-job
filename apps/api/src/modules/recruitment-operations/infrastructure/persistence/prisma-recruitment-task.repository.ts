import { Injectable } from '@nestjs/common';
import type { RecruitmentActionTask as PrismaRecruitmentTask, Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { RecruitmentTaskRepository, RecruitmentTaskListFilter } from '../../domain/ports/recruitment-task.repository';
import { RecruitmentTaskRecord, CreateRecruitmentTaskInput, RecruitmentTaskType, RecruitmentTaskStatus } from '../../domain/models/recruitment-task';

@Injectable()
export class PrismaRecruitmentTaskRepository implements RecruitmentTaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<RecruitmentTaskRecord | null> {
    const row = await this.prisma.recruitmentActionTask.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<RecruitmentTaskRecord | null> {
    const row = await this.prisma.recruitmentActionTask.findUnique({ where: { idempotencyKey } });
    return row ? this.toRecord(row) : null;
  }

  /** Real DB-level dedup via the `idempotencyKey` unique constraint — same check-then-insert-
   * with-catch-and-refetch shape as M29's `NotificationRepository.createIfNotDuplicate()`, proven
   * race-safe under real concurrency there. */
  async createIfNotDuplicate(input: CreateRecruitmentTaskInput, now: Date): Promise<{ readonly task: RecruitmentTaskRecord; readonly wasNewlyCreated: boolean }> {
    const existing = await this.prisma.recruitmentActionTask.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      return { task: this.toRecord(existing), wasNewlyCreated: false };
    }
    try {
      const created = await this.prisma.recruitmentActionTask.create({
        data: {
          userId: input.userId,
          applicationId: input.applicationId,
          companyId: input.companyId,
          jobId: input.jobId,
          sourceInboxMessageId: input.sourceInboxMessageId,
          taskType: input.taskType as unknown as Prisma.RecruitmentActionTaskCreateInput['taskType'],
          title: input.title,
          explanation: input.explanation,
          evidence: input.evidence as unknown as Prisma.InputJsonValue,
          priority: input.priority,
          dueAt: input.dueAt,
          dueDateConfidence: input.dueDateConfidence,
          originalDateText: input.originalDateText,
          correlationId: input.correlationId,
          idempotencyKey: input.idempotencyKey,
          createdAt: now,
          updatedAt: now,
        },
      });
      return { task: this.toRecord(created), wasNewlyCreated: true };
    } catch (error) {
      const raced = await this.prisma.recruitmentActionTask.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (raced) return { task: this.toRecord(raced), wasNewlyCreated: false };
      throw error;
    }
  }

  async markInProgress(id: string, now: Date): Promise<RecruitmentTaskRecord> {
    const row = await this.prisma.recruitmentActionTask.update({ where: { id }, data: { status: 'IN_PROGRESS', updatedAt: now } });
    return this.toRecord(row);
  }

  async markCompleted(id: string, now: Date): Promise<RecruitmentTaskRecord> {
    const row = await this.prisma.recruitmentActionTask.update({ where: { id }, data: { status: 'COMPLETED', completedAt: now, updatedAt: now } });
    return this.toRecord(row);
  }

  async markDismissed(id: string, reason: string | null, now: Date): Promise<RecruitmentTaskRecord> {
    const row = await this.prisma.recruitmentActionTask.update({ where: { id }, data: { status: 'DISMISSED', dismissedAt: now, dismissReason: reason, updatedAt: now } });
    return this.toRecord(row);
  }

  async markExpired(id: string, now: Date): Promise<RecruitmentTaskRecord> {
    const row = await this.prisma.recruitmentActionTask.update({ where: { id }, data: { status: 'EXPIRED', updatedAt: now } });
    return this.toRecord(row);
  }

  async confirmDueDate(id: string, dueAt: Date, now: Date): Promise<RecruitmentTaskRecord> {
    const row = await this.prisma.recruitmentActionTask.update({ where: { id }, data: { dueAt, dueDateConfidence: 'RELIABLE', updatedAt: now } });
    return this.toRecord(row);
  }

  async list(filter: RecruitmentTaskListFilter, limit: number, offset: number): Promise<RecruitmentTaskRecord[]> {
    const rows = await this.prisma.recruitmentActionTask.findMany({
      where: {
        userId: filter.userId,
        status: filter.status as unknown as Prisma.RecruitmentActionTaskWhereInput['status'],
        applicationId: filter.applicationId,
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    });
    return rows.map((row) => this.toRecord(row));
  }

  async listOverdueOpen(now: Date, limit: number): Promise<RecruitmentTaskRecord[]> {
    const rows = await this.prisma.recruitmentActionTask.findMany({
      where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, dueAt: { not: null, lte: now } },
      take: limit,
      orderBy: { dueAt: 'asc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async listDueForDeadlineReminder(now: Date, leadTimeMs: number, limit: number): Promise<RecruitmentTaskRecord[]> {
    const horizon = new Date(now.getTime() + leadTimeMs);
    const rows = await this.prisma.recruitmentActionTask.findMany({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        dueAt: { not: null, gt: now, lte: horizon },
        deadlineReminderSentAt: null,
      },
      take: limit,
      orderBy: { dueAt: 'asc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async markDeadlineReminderSent(id: string, now: Date): Promise<void> {
    await this.prisma.recruitmentActionTask.update({ where: { id }, data: { deadlineReminderSentAt: now, updatedAt: now } });
  }

  private toRecord(row: PrismaRecruitmentTask): RecruitmentTaskRecord {
    return {
      id: row.id,
      userId: row.userId,
      applicationId: row.applicationId,
      companyId: row.companyId,
      jobId: row.jobId,
      sourceInboxMessageId: row.sourceInboxMessageId,
      taskType: row.taskType as unknown as RecruitmentTaskType,
      title: row.title,
      explanation: row.explanation,
      evidence: row.evidence as unknown as Record<string, unknown> | null,
      priority: row.priority as unknown as 'LOW' | 'NORMAL' | 'HIGH',
      dueAt: row.dueAt,
      dueDateConfidence: row.dueDateConfidence as unknown as 'RELIABLE' | 'AMBIGUOUS' | null,
      originalDateText: row.originalDateText,
      status: row.status as unknown as RecruitmentTaskStatus,
      completedAt: row.completedAt,
      dismissedAt: row.dismissedAt,
      dismissReason: row.dismissReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      correlationId: row.correlationId,
      idempotencyKey: row.idempotencyKey,
    };
  }
}
