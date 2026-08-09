import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { RecruitmentTaskRepository, RECRUITMENT_TASK_REPOSITORY, RecruitmentTaskListFilter } from '../../domain/ports/recruitment-task.repository';
import { RecruitmentTaskRecord, CreateRecruitmentTaskInput, RecruitmentTaskType } from '../../domain/models/recruitment-task';

export interface CreateTaskInput {
  readonly userId: string;
  readonly applicationId: string;
  readonly companyId: string | null;
  readonly jobId: string | null;
  readonly sourceInboxMessageId: string | null;
  readonly taskType: RecruitmentTaskType;
  readonly title: string;
  readonly explanation: string;
  readonly evidence: Readonly<Record<string, unknown>> | null;
  readonly priority: 'LOW' | 'NORMAL' | 'HIGH';
  readonly dueAt: Date | null;
  readonly dueDateConfidence: 'RELIABLE' | 'AMBIGUOUS' | null;
  readonly originalDateText: string | null;
  readonly correlationId: string | null;
}

/**
 * M30 Phase 8 — the one authoritative writer of `RecruitmentActionTask`. Idempotency key is
 * deterministic per (sourceInboxMessageId, taskType) — a duplicate provider event replay
 * (`ReplyIngestionService` itself already short-circuits on `alreadyProcessed`, this is the
 * second, DB-level layer, matching `FollowUpControlService`'s identical discipline).
 */
@Injectable()
export class RecruitmentTaskService {
  constructor(
    @Inject(RECRUITMENT_TASK_REPOSITORY) private readonly tasks: RecruitmentTaskRepository,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly audit: EmailSecurityAuditService,
  ) {}

  static idempotencyKeyFor(applicationId: string, sourceInboxMessageId: string | null, taskType: RecruitmentTaskType): string {
    return `recruitment-task:${applicationId}:${sourceInboxMessageId ?? 'manual'}:${taskType}`;
  }

  async createTask(input: CreateTaskInput): Promise<{ readonly task: RecruitmentTaskRecord; readonly wasNewlyCreated: boolean }> {
    const now = this.clock.now();
    const idempotencyKey = RecruitmentTaskService.idempotencyKeyFor(input.applicationId, input.sourceInboxMessageId, input.taskType);

    const createInput: CreateRecruitmentTaskInput = {
      userId: input.userId,
      applicationId: input.applicationId,
      companyId: input.companyId,
      jobId: input.jobId,
      sourceInboxMessageId: input.sourceInboxMessageId,
      taskType: input.taskType,
      title: input.title,
      explanation: input.explanation,
      evidence: input.evidence,
      priority: input.priority,
      dueAt: input.dueAt,
      dueDateConfidence: input.dueDateConfidence,
      originalDateText: input.originalDateText,
      correlationId: input.correlationId,
      idempotencyKey,
    };

    const result = await this.tasks.createIfNotDuplicate(createInput, now);
    if (result.wasNewlyCreated) {
      await this.audit.record({ eventType: 'RECRUITMENT_TASK_CREATED', userId: input.userId, applicationId: input.applicationId, inboxMessageId: input.sourceInboxMessageId, detail: `${input.taskType}: ${input.title}` });
    }
    return result;
  }

  async completeTask(taskId: string, userId: string): Promise<RecruitmentTaskRecord> {
    const now = this.clock.now();
    const task = await this.requireOwnedTask(taskId, userId);
    const updated = await this.tasks.markCompleted(task.id, now);
    await this.audit.record({ eventType: 'RECRUITMENT_TASK_COMPLETED', userId, applicationId: task.applicationId, detail: `Completed: ${task.title}` });
    return updated;
  }

  async dismissTask(taskId: string, userId: string, reason: string | null): Promise<RecruitmentTaskRecord> {
    const now = this.clock.now();
    const task = await this.requireOwnedTask(taskId, userId);
    const updated = await this.tasks.markDismissed(task.id, reason, now);
    await this.audit.record({ eventType: 'RECRUITMENT_TASK_DISMISSED', userId, applicationId: task.applicationId, detail: `Dismissed: ${task.title}${reason ? ` — ${reason}` : ''}` });
    return updated;
  }

  /** Phase 9 — a user confirming an ambiguous extracted date turns it into a real due date; never
   * silently guessed by the system itself. */
  async confirmDueDate(taskId: string, userId: string, dueAt: Date): Promise<RecruitmentTaskRecord> {
    const now = this.clock.now();
    const task = await this.requireOwnedTask(taskId, userId);
    const updated = await this.tasks.confirmDueDate(task.id, dueAt, now);
    await this.audit.record({ eventType: 'DEADLINE_CONFIRMED', userId, applicationId: task.applicationId, detail: `Deadline confirmed for "${task.title}": ${dueAt.toISOString()}` });
    return updated;
  }

  async listForUser(filter: RecruitmentTaskListFilter, limit: number, offset: number): Promise<RecruitmentTaskRecord[]> {
    return this.tasks.list(filter, limit, offset);
  }

  private async requireOwnedTask(taskId: string, userId: string): Promise<RecruitmentTaskRecord> {
    const task = await this.tasks.findById(taskId);
    if (!task) {
      throw new NotFoundException('Recruitment task not found.');
    }
    if (task.userId !== userId) {
      // Never reveal whether the id belongs to someone else — same anti-enumeration shape as
      // `InboxIntelligenceController.requireOwnedMessage()`.
      throw new NotFoundException('Recruitment task not found.');
    }
    return task;
  }
}
