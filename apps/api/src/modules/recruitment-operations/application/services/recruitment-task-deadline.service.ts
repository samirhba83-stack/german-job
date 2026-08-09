import { Inject, Injectable, Logger } from '@nestjs/common';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { RecruitmentTaskRepository, RECRUITMENT_TASK_REPOSITORY } from '../../domain/ports/recruitment-task.repository';
import { RECRUITMENT_NOTIFICATION_PORT, RecruitmentNotificationPort } from '../../domain/ports/recruitment-notification.port';

/** AUTONOMY-confirmed default (this milestone's own clarifying question): notify 48 hours before
 * a task's real due date. */
const DEADLINE_LEAD_TIME_MS = 48 * 60 * 60 * 1000;

/**
 * M30 Phase 9 (deadline reminders) / Phase 8 (overdue handling) — the confirmed default: an
 * overdue OPEN/IN_PROGRESS task is marked EXPIRED plus exactly one escalation notification, never
 * silently left open forever and never repeatedly re-notified.
 */
@Injectable()
export class RecruitmentTaskDeadlineService {
  private readonly logger = new Logger(RecruitmentTaskDeadlineService.name);

  constructor(
    @Inject(RECRUITMENT_TASK_REPOSITORY) private readonly tasks: RecruitmentTaskRepository,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    @Inject(RECRUITMENT_NOTIFICATION_PORT) private readonly notifications: RecruitmentNotificationPort,
    private readonly audit: EmailSecurityAuditService,
  ) {}

  async sendDueReminders(limit = 100): Promise<number> {
    const now = this.clock.now();
    const due = await this.tasks.listDueForDeadlineReminder(now, DEADLINE_LEAD_TIME_MS, limit);
    for (const task of due) {
      await this.notifications.notify({
        userId: task.userId,
        kind: 'DEADLINE_APPROACHING',
        relatedApplicationId: task.applicationId,
        title: 'A deadline is approaching',
        body: `"${task.title}" is due ${task.dueAt ? task.dueAt.toISOString() : 'soon'}.`,
        dedupeKey: `TASK_DEADLINE_REMINDER:${task.id}`,
      });
      await this.tasks.markDeadlineReminderSent(task.id, now);
    }
    return due.length;
  }

  async expireOverdueTasks(limit = 100): Promise<number> {
    const now = this.clock.now();
    const overdue = await this.tasks.listOverdueOpen(now, limit);
    for (const task of overdue) {
      await this.tasks.markExpired(task.id, now);
      await this.audit.record({ eventType: 'RECRUITMENT_TASK_DISMISSED', userId: task.userId, applicationId: task.applicationId, detail: `Task "${task.title}" expired (overdue past ${task.dueAt?.toISOString()}).` });
      await this.notifications.notify({
        userId: task.userId,
        kind: 'TASK_OVERDUE',
        relatedApplicationId: task.applicationId,
        title: 'A task is now overdue',
        body: `"${task.title}" was not completed by its due date and is now marked overdue.`,
        dedupeKey: `TASK_OVERDUE_ESCALATION:${task.id}`,
      });
      this.logger.log(`Recruitment task ${task.id} expired (overdue).`);
    }
    return overdue.length;
  }
}
