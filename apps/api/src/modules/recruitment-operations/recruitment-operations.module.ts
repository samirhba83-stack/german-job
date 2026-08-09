import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExecutionModule } from '../execution/execution.module';
import { DocumentsModule } from '../documents/documents.module';
import { ApplicationsModule } from '../applications/applications.module';
import { FOLLOW_UP_CONTROL_REPOSITORY } from './domain/ports/follow-up-control.repository';
import { RECRUITMENT_TASK_REPOSITORY } from './domain/ports/recruitment-task.repository';
import { RECRUITMENT_NOTIFICATION_PORT } from './domain/ports/recruitment-notification.port';
import { PrismaFollowUpControlRepository } from './infrastructure/persistence/prisma-follow-up-control.repository';
import { PrismaRecruitmentTaskRepository } from './infrastructure/persistence/prisma-recruitment-task.repository';
import { PrismaRecruitmentNotificationAdapter } from './infrastructure/persistence/prisma-recruitment-notification.adapter';
import { FollowUpControlService } from './application/services/follow-up-control.service';
import { FollowUpEligibilityService } from './application/services/follow-up-eligibility.service';
import { RecruitmentTaskService } from './application/services/recruitment-task.service';
import { FollowUpResumeService } from './application/services/follow-up-resume.service';
import { RecruitmentTaskDeadlineService } from './application/services/recruitment-task-deadline.service';
import { RecruitmentOperationsTickDriverService } from './application/services/recruitment-operations-tick-driver.service';
import { RecruitmentOperationsController } from './presentation/controllers/recruitment-operations.controller';
import { AdminRecruitmentOperationsController } from './presentation/controllers/admin-recruitment-operations.controller';

/**
 * M30 — Recruitment Workflow Orchestration: `ApplicationFollowUpControl`, `RecruitmentActionTask`,
 * and the eligibility/resume/deadline services that act on them. Depends on `applications` (real
 * `ApplicationRepository` lookups — ownership checks, existence checks), `documents` (the shared
 * `EmailSecurityAuditService`), and `execution` (`ExecutionClock`). Deliberately does NOT depend
 * on `inbox-intelligence`, `campaigns`, or `execution-activation` — this module only ever receives
 * plain identifiers (`applicationId`, `campaignId`, `companyId`, `jobId`) from its callers, never
 * imports their domain types, keeping the dependency graph one-directional in BOTH directions
 * that use it: `inbox-intelligence -> recruitment-operations` (creates controls/tasks from a
 * classified reply) and `execution-activation -> recruitment-operations` (checks eligibility
 * before a real send) — neither of which need to depend on each other.
 *
 * Self-caught fix (found running the full e2e suite): `RecruitmentOperationsTickDriverService`
 * injects `ConfigService` directly (to read the tick-interval env vars) but this module never
 * imported `ConfigModule` — the identical pre-existing-elsewhere gap found and fixed in
 * `DocumentsModule`/`EmailProviderModule`/`BillingModule`/`ConnectedMailboxModule`/
 * `DeliverabilityModule`, this time in code this milestone itself wrote.
 *
 * `RecruitmentOperationsTickDriverService` also injects `SchedulerRegistry` for its own
 * `@Cron`-driven ticks — deliberately NOT fixed the same way: `SchedulerRegistry` is only provided
 * via `ScheduleModule.forRoot()`, which is correctly called exactly once, in `AppModule`; calling
 * it again here would risk duplicate cron-job registration in the real app. See
 * `DeliverabilityModule`'s identical doc comment and `docs/recruitment-operations/
 * known-limitations.md` for the full reasoning — this only affects one narrow, pre-existing,
 * hand-assembled partial test module that never bootstraps the real `AppModule`.
 */
@Module({
  imports: [ExecutionModule, DocumentsModule, ApplicationsModule, ConfigModule],
  controllers: [RecruitmentOperationsController, AdminRecruitmentOperationsController],
  providers: [
    { provide: FOLLOW_UP_CONTROL_REPOSITORY, useClass: PrismaFollowUpControlRepository },
    { provide: RECRUITMENT_TASK_REPOSITORY, useClass: PrismaRecruitmentTaskRepository },
    { provide: RECRUITMENT_NOTIFICATION_PORT, useClass: PrismaRecruitmentNotificationAdapter },
    FollowUpControlService,
    FollowUpEligibilityService,
    RecruitmentTaskService,
    FollowUpResumeService,
    RecruitmentTaskDeadlineService,
    RecruitmentOperationsTickDriverService,
  ],
  exports: [FollowUpControlService, FollowUpEligibilityService, RecruitmentTaskService, FOLLOW_UP_CONTROL_REPOSITORY, RECRUITMENT_TASK_REPOSITORY],
})
export class RecruitmentOperationsModule {}
