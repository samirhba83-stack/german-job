import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { FollowUpResumeService } from './follow-up-resume.service';
import { RecruitmentTaskDeadlineService } from './recruitment-task-deadline.service';

const RESUME_TICK_NAME = 'recruitment-followup-resume-tick';
const DEADLINE_TICK_NAME = 'recruitment-task-deadline-tick';

/**
 * M30 Phase 9/10 — matching `InboxPollingTickDriverService`'s (M29) already-proven manual-
 * `setInterval` + `SchedulerRegistry` pattern exactly. Two independent ticks: resuming expired
 * holds (Phase 10) and task deadline reminders/overdue-expiry (Phase 9/8). Neither tick is gated
 * behind `replyDrivenExecutionEnabled` — expiring a stale hold and reminding about a real deadline
 * are safe, reversible, non-dispatch-affecting operations that should keep working even while the
 * higher-stakes dispatch-side enforcement flag stays off during rollout.
 */
@Injectable()
export class RecruitmentOperationsTickDriverService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecruitmentOperationsTickDriverService.name);
  private resumeRunning = false;
  private deadlineRunning = false;
  private destroyed = false;

  constructor(
    private readonly resumeService: FollowUpResumeService,
    private readonly deadlineService: RecruitmentTaskDeadlineService,
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    // M31 Phase 3/4 — real API/Worker process split; see `EmailQueueWorkerService`'s identical gate.
    // Neither of this service's two ticks has a cross-process lock of its own (Phase 1 audit
    // finding) — on a split-process topology this gate is the real protection.
    if (!this.config.get<boolean>('app.runTicks', true)) {
      this.logger.log('RUN_TICKS=false — recruitment-operations ticks not registered on this process.');
      return;
    }
    const resumeIntervalMs = this.config.get<number>('recruitmentOperations.tick.resumeIntervalMs', 30 * 60 * 1000);
    const resumeInterval = setInterval(() => void this.resumeTick(), resumeIntervalMs);
    this.schedulerRegistry.addInterval(RESUME_TICK_NAME, resumeInterval);
    this.logger.log(`Follow-up resume tick registered every ${resumeIntervalMs}ms.`);

    const deadlineIntervalMs = this.config.get<number>('recruitmentOperations.tick.deadlineIntervalMs', 15 * 60 * 1000);
    const deadlineInterval = setInterval(() => void this.deadlineTick(), deadlineIntervalMs);
    this.schedulerRegistry.addInterval(DEADLINE_TICK_NAME, deadlineInterval);
    this.logger.log(`Recruitment task deadline tick registered every ${deadlineIntervalMs}ms.`);
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    if (this.schedulerRegistry.doesExist('interval', RESUME_TICK_NAME)) this.schedulerRegistry.deleteInterval(RESUME_TICK_NAME);
    if (this.schedulerRegistry.doesExist('interval', DEADLINE_TICK_NAME)) this.schedulerRegistry.deleteInterval(DEADLINE_TICK_NAME);
  }

  async resumeTick(): Promise<void> {
    if (this.destroyed || this.resumeRunning) return;
    this.resumeRunning = true;
    try {
      const result = await this.resumeService.processExpiredHolds(100);
      if (result.expired > 0 || result.resuperseded > 0) {
        this.logger.log(`Follow-up resume tick: ${result.expired} expired, ${result.resuperseded} superseded with permanent suppression.`);
      }
    } catch (error) {
      this.logger.error(`Follow-up resume tick failed: ${error instanceof Error ? error.stack : String(error)}`);
    } finally {
      this.resumeRunning = false;
    }
  }

  async deadlineTick(): Promise<void> {
    if (this.destroyed || this.deadlineRunning) return;
    this.deadlineRunning = true;
    try {
      await this.deadlineService.sendDueReminders(100);
      await this.deadlineService.expireOverdueTasks(100);
    } catch (error) {
      this.logger.error(`Recruitment task deadline tick failed: ${error instanceof Error ? error.stack : String(error)}`);
    } finally {
      this.deadlineRunning = false;
    }
  }
}
