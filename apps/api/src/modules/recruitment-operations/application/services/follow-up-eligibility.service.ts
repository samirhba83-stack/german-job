import { Inject, Injectable } from '@nestjs/common';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { FollowUpControlRepository, FOLLOW_UP_CONTROL_REPOSITORY } from '../../domain/ports/follow-up-control.repository';
import { FollowUpEligibilityResult } from '../../domain/models/follow-up-control';
import { evaluateFollowUpEligibility } from '../../domain/services/follow-up-eligibility-evaluator';

/**
 * M30 Phase 4 — the one authoritative gate. In THIS codebase's real architecture (confirmed by
 * the Phase 1 audit) campaign-target scheduling/queue-insertion/reservation/final-send are not
 * separately persisted stages the way an EmailMessage queue's are — `Campaign.planNextBatch()`
 * selects and marks a target QUEUED, then `CampaignBatchDispatchService.dispatchOneTarget()`
 * resolves/creates the real `Application` and sends, all inside one synchronous call. This
 * service is therefore called from exactly ONE real call site — immediately after the
 * application id is resolved and immediately before the real provider send — which is honestly
 * both "queue insertion" and "final pre-send recheck" collapsed into a single, always-executed
 * checkpoint (documented in `docs/recruitment-operations/known-limitations.md`), not a shortcut:
 * every real target that could ever be dispatched passes through this exact call, unconditionally.
 */
@Injectable()
export class FollowUpEligibilityService {
  constructor(
    @Inject(FOLLOW_UP_CONTROL_REPOSITORY) private readonly controls: FollowUpControlRepository,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly audit: EmailSecurityAuditService,
  ) {}

  async checkEligibility(applicationId: string, userId: string | null): Promise<FollowUpEligibilityResult> {
    const now = this.clock.now();
    const active = await this.controls.findActiveByApplicationId(applicationId);
    const result = evaluateFollowUpEligibility(active, now);

    await this.audit.record({
      eventType: 'FOLLOW_UP_ELIGIBILITY_CHECKED',
      userId,
      applicationId,
      detail: `${result.status}: ${result.explanation}`,
    });

    return result;
  }
}
