import { RecruitmentTaskRecord, CreateRecruitmentTaskInput, RecruitmentTaskStatus } from '../models/recruitment-task';

export const RECRUITMENT_TASK_REPOSITORY = Symbol('RECRUITMENT_TASK_REPOSITORY');

export interface RecruitmentTaskListFilter {
  readonly userId: string;
  readonly status?: RecruitmentTaskStatus;
  readonly applicationId?: string;
}

export interface RecruitmentTaskRepository {
  findById(id: string): Promise<RecruitmentTaskRecord | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<RecruitmentTaskRecord | null>;

  /** Real dedup on (sourceInboxMessageId, taskType) via the idempotency key the caller computes —
   * see `CreateRecruitmentTaskInput`'s own doc comment. Returns the existing row unchanged if the
   * key already exists (never throws for a legitimate duplicate-event replay). */
  createIfNotDuplicate(input: CreateRecruitmentTaskInput, now: Date): Promise<{ readonly task: RecruitmentTaskRecord; readonly wasNewlyCreated: boolean }>;

  markInProgress(id: string, now: Date): Promise<RecruitmentTaskRecord>;
  markCompleted(id: string, now: Date): Promise<RecruitmentTaskRecord>;
  markDismissed(id: string, reason: string | null, now: Date): Promise<RecruitmentTaskRecord>;
  markExpired(id: string, now: Date): Promise<RecruitmentTaskRecord>;
  confirmDueDate(id: string, dueAt: Date, now: Date): Promise<RecruitmentTaskRecord>;

  list(filter: RecruitmentTaskListFilter, limit: number, offset: number): Promise<RecruitmentTaskRecord[]>;

  /** Every OPEN/IN_PROGRESS task past its `dueAt` — the overdue-expiry tick driver's one real
   * query (confirmed default: mark EXPIRED + one escalation notification). */
  listOverdueOpen(now: Date, limit: number): Promise<RecruitmentTaskRecord[]>;

  /** Every OPEN/IN_PROGRESS task whose `dueAt` falls within the notification lead-time window and
   * has not yet been notified (Phase 9's confirmed 48-hour lead time). */
  listDueForDeadlineReminder(now: Date, leadTimeMs: number, limit: number): Promise<RecruitmentTaskRecord[]>;
  markDeadlineReminderSent(id: string, now: Date): Promise<void>;
}
