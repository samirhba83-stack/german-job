import { Inject, Injectable, Logger } from '@nestjs/common';
import { ApplicationLifecycleStatus } from '@german-job-engine/shared-types';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { APPLICATION_REPOSITORY, ApplicationRepository } from '../../../applications/domain/repositories/application.repository.interface';
import { FollowUpControlRepository, FOLLOW_UP_CONTROL_REPOSITORY } from '../../domain/ports/follow-up-control.repository';
import { FollowUpControlService } from './follow-up-control.service';

/** Applications in any of these states should never resume automated follow-ups, regardless of
 * what the original hold's timer says — the application moved on through some OTHER real path
 * (e.g. the candidate manually withdrew) while the hold was still counting down. */
const RESUME_BLOCKING_STATUSES: ReadonlySet<ApplicationLifecycleStatus> = new Set([
  ApplicationLifecycleStatus.REJECTED,
  ApplicationLifecycleStatus.WITHDRAWN,
  ApplicationLifecycleStatus.ARCHIVED,
  ApplicationLifecycleStatus.CONTRACT_SIGNED,
  ApplicationLifecycleStatus.INTERVIEW_SCHEDULED,
  ApplicationLifecycleStatus.INTERVIEW_COMPLETED,
  ApplicationLifecycleStatus.OFFER_RECEIVED,
]);

/**
 * M30 Phase 10 — the one real, safe resume path. Deliberately narrow: this service's only real
 * job is to move an expired ACTIVE hold to EXPIRED (or, if the application has since reached a
 * terminal/high-impact state through some OTHER path, supersede it with a real
 * PERMANENT_SUPPRESSION instead of silently resuming). It does NOT re-verify campaign status,
 * mailbox readiness, subscription entitlement, or deliverability suppression itself — those real
 * checks already run, unconditionally, on every real dispatch attempt inside
 * `CampaignBatchDispatchService.dispatchOneTarget()` (business policy enforcement, connected-
 * mailbox readiness, deliverability), and duplicating them here would only risk them drifting out
 * of sync with the real source of truth. "Resumed" only ever means "no longer follow-up-blocked" —
 * never "guaranteed to send"; the very next real dispatch attempt still passes through every
 * other existing, unweakened gate exactly as it always has.
 *
 * "Never automatically resume a permanently suppressed target" (Phase 10) is structurally
 * guaranteed, not just asserted: `PERMANENT_SUPPRESSION`/`DELIVERABILITY_BLOCK` controls are
 * created with `expiresAt: null` (see `ReplyIngestionService`), so `listExpiredActive()` — which
 * filters on a real, non-null `expiresAt` — can never return one.
 */
@Injectable()
export class FollowUpResumeService {
  private readonly logger = new Logger(FollowUpResumeService.name);

  constructor(
    @Inject(FOLLOW_UP_CONTROL_REPOSITORY) private readonly controls: FollowUpControlRepository,
    @Inject(APPLICATION_REPOSITORY) private readonly applications: ApplicationRepository,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly followUpControlService: FollowUpControlService,
    private readonly audit: EmailSecurityAuditService,
  ) {}

  /** Processes every currently-expired ACTIVE control — the resume tick driver's one real call. */
  async processExpiredHolds(limit = 100): Promise<{ readonly expired: number; readonly resuperseded: number }> {
    const now = this.clock.now();
    const candidates = await this.controls.listExpiredActive(now, limit);
    let expired = 0;
    let resuperseded = 0;

    for (const control of candidates) {
      const application = await this.applications.findById(control.applicationId);

      if (application && RESUME_BLOCKING_STATUSES.has(application.status)) {
        // The application moved on through a real, different path while this hold was counting
        // down — supersede with a real permanent record rather than silently resuming.
        await this.followUpControlService.recordControl({
          userId: control.userId,
          applicationId: control.applicationId,
          campaignId: control.campaignId,
          companyId: control.companyId,
          jobId: control.jobId,
          sourceInboxMessageId: null,
          sourceProviderMessageId: null,
          controlType: 'PERMANENT_SUPPRESSION',
          reasonCode: 'APPLICATION_STATUS_ADVANCED',
          explanation: `The application reached status ${application.status} while this hold was active — follow-ups permanently suppressed rather than resumed.`,
          classification: null,
          confidence: null,
          evidence: { previousControlId: control.id, applicationStatus: application.status },
          expiresAt: null,
          correlationId: control.correlationId,
        });
        resuperseded += 1;
        continue;
      }

      const releasedControl = await this.controls.markExpired(control.id, now);
      await this.audit.record({ eventType: 'FOLLOW_UP_HOLD_EXPIRED', userId: control.userId, applicationId: control.applicationId, detail: `${control.controlType} expired at ${now.toISOString()} — eligible for resume.` });
      await this.audit.record({ eventType: 'FOLLOW_UP_RESUME_PROPOSED', userId: control.userId, applicationId: control.applicationId, detail: 'Follow-ups may resume on the next real dispatch attempt, subject to every other existing eligibility check.' });
      expired += 1;
      this.logger.log(`Follow-up hold ${releasedControl.id} expired for application ${control.applicationId}.`);
    }

    return { expired, resuperseded };
  }
}
