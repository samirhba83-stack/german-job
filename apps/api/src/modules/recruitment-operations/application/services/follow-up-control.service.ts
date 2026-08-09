import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { FollowUpControlRepository, FOLLOW_UP_CONTROL_REPOSITORY } from '../../domain/ports/follow-up-control.repository';
import { FollowUpControlRecord, CreateFollowUpControlInput, FollowUpControlType } from '../../domain/models/follow-up-control';

export interface RecordControlInput {
  readonly userId: string;
  readonly applicationId: string;
  readonly campaignId: string | null;
  readonly companyId: string | null;
  readonly jobId: string | null;
  readonly sourceInboxMessageId: string | null;
  readonly sourceProviderMessageId: string | null;
  readonly controlType: FollowUpControlType;
  readonly reasonCode: string;
  readonly explanation: string;
  readonly classification: string | null;
  readonly confidence: number | null;
  readonly evidence: Readonly<Record<string, unknown>> | null;
  readonly expiresAt: Date | null;
  readonly correlationId: string | null;
}

/** Never a real "who may release a compliance/security suppression" bypass — Phase 16: "no user
 * may manually release a compliance or security suppression." `DELIVERABILITY_BLOCK` is the one
 * control type this codebase's real deliverability policy owns; a candidate releasing it here
 * would let them re-target a recipient the platform's own suppression list still blocks at send
 * time anyway (defense in depth), but is refused up front to avoid a misleading "released"
 * confirmation. */
const USER_RELEASABLE_TYPES: ReadonlySet<FollowUpControlType> = new Set(['TEMPORARY_HOLD', 'PERMANENT_SUPPRESSION', 'WAITING_PERIOD', 'MANUAL_REVIEW_HOLD']);

const AUDIT_EVENT_BY_CONTROL_TYPE: Readonly<Record<FollowUpControlType, 'FOLLOW_UP_TEMPORARILY_HELD' | 'FOLLOW_UP_PERMANENTLY_SUPPRESSED'>> = {
  TEMPORARY_HOLD: 'FOLLOW_UP_TEMPORARILY_HELD',
  WAITING_PERIOD: 'FOLLOW_UP_TEMPORARILY_HELD',
  MANUAL_REVIEW_HOLD: 'FOLLOW_UP_TEMPORARILY_HELD',
  PERMANENT_SUPPRESSION: 'FOLLOW_UP_PERMANENTLY_SUPPRESSED',
  DELIVERABILITY_BLOCK: 'FOLLOW_UP_PERMANENTLY_SUPPRESSED',
};

/**
 * M30 Phase 3 — the one authoritative writer of `ApplicationFollowUpControl`. Every create goes
 * through `createSuperseding()` (Non-Negotiable Principle #1: never overwrite historical truth —
 * a NEW decision supersedes the OLD row, it never rewrites it in place).
 */
@Injectable()
export class FollowUpControlService {
  constructor(
    @Inject(FOLLOW_UP_CONTROL_REPOSITORY) private readonly controls: FollowUpControlRepository,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly audit: EmailSecurityAuditService,
  ) {}

  /** Deterministic idempotency key — a real defense against a duplicate provider event (a
   * redelivered webhook/poll notification) creating a second control for the same source message
   * and control type (Non-Negotiable Principle #9). `ReplyIngestionService`'s own top-level
   * `alreadyProcessed` guard already prevents most of this; this is the second, independent layer
   * enforced at the DB level via the `idempotencyKey` unique constraint. */
  static idempotencyKeyFor(applicationId: string, sourceInboxMessageId: string | null, controlType: FollowUpControlType): string {
    return `followup-control:${applicationId}:${sourceInboxMessageId ?? 'manual'}:${controlType}`;
  }

  async recordControl(input: RecordControlInput): Promise<FollowUpControlRecord> {
    const now = this.clock.now();
    const idempotencyKey = FollowUpControlService.idempotencyKeyFor(input.applicationId, input.sourceInboxMessageId, input.controlType);

    const existing = await this.controls.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      return existing; // real, silent no-op for a genuine duplicate event replay
    }

    const createInput: CreateFollowUpControlInput = {
      userId: input.userId,
      applicationId: input.applicationId,
      campaignId: input.campaignId,
      companyId: input.companyId,
      jobId: input.jobId,
      sourceInboxMessageId: input.sourceInboxMessageId,
      sourceProviderMessageId: input.sourceProviderMessageId,
      controlType: input.controlType,
      reasonCode: input.reasonCode,
      explanation: input.explanation,
      classification: input.classification,
      confidence: input.confidence,
      evidence: input.evidence,
      createdByActorType: 'SYSTEM',
      createdByActorId: null,
      expiresAt: input.expiresAt,
      correlationId: input.correlationId,
      idempotencyKey,
    };

    let created: FollowUpControlRecord;
    try {
      created = await this.controls.createSuperseding(createInput, now);
    } catch (error) {
      // A genuine concurrent race lost against the partial unique index — re-fetch and return
      // whichever control actually won, rather than throwing on a real, already-handled duplicate.
      const raced = await this.controls.findByIdempotencyKey(idempotencyKey);
      if (raced) return raced;
      const active = await this.controls.findActiveByApplicationId(input.applicationId);
      if (active) return active;
      throw error;
    }

    await this.audit.record({
      eventType: 'FOLLOW_UP_CONTROL_CREATED',
      userId: input.userId,
      applicationId: input.applicationId,
      inboxMessageId: input.sourceInboxMessageId,
      detail: `${input.controlType} recorded: ${input.explanation}`,
    });
    await this.audit.record({
      eventType: AUDIT_EVENT_BY_CONTROL_TYPE[input.controlType],
      userId: input.userId,
      applicationId: input.applicationId,
      inboxMessageId: input.sourceInboxMessageId,
      detail: input.explanation,
    });

    return created;
  }

  /** Phase 16: "no user may manually release a compliance or security suppression" —
   * `DELIVERABILITY_BLOCK` is refused. Phase 15/authorization: caller (controller) already
   * verified `control.userId === requestingUserId` before this is reached. */
  async release(controlId: string, releasedBy: string, releaseReason: string): Promise<FollowUpControlRecord> {
    const now = this.clock.now();
    const control = await this.controls.findById(controlId);
    if (!control) {
      throw new NotFoundException('Follow-up control not found.');
    }
    if (control.status !== 'ACTIVE') {
      throw new ForbiddenException('Only an active follow-up control can be released.');
    }
    if (!USER_RELEASABLE_TYPES.has(control.controlType)) {
      throw new ForbiddenException('This control type cannot be manually released.');
    }

    const released = await this.controls.release(controlId, releasedBy, releaseReason, now);
    await this.audit.record({ eventType: 'FOLLOW_UP_RELEASED', userId: control.userId, applicationId: control.applicationId, detail: `Released by ${releasedBy}: ${releaseReason}` });
    return released;
  }

  /** Admin override — self-caught fix: the admin controller previously called
   * `FollowUpControlRepository.release()` directly, which unconditionally flips a row's status to
   * `RELEASED` with no check on its current status. That let an admin "release" a control that was
   * already RELEASED/EXPIRED/SUPERSEDED — silently rewriting a historical record (Non-Negotiable
   * Principle #1) and, worse, misleadingly reporting success while the application's real active
   * suppression (a *different*, newer row, if one exists) stayed untouched. This method carries the
   * same `status !== 'ACTIVE'` guard `release()` uses, but — deliberately, unlike `release()` —
   * does NOT check `USER_RELEASABLE_TYPES`, since an admin (unlike a candidate, Phase 16: "no user
   * may manually release a compliance or security suppression") may release a `DELIVERABILITY_BLOCK`. */
  async releaseAsAdmin(controlId: string, adminUserId: string, releaseReason: string): Promise<FollowUpControlRecord> {
    const now = this.clock.now();
    const control = await this.controls.findById(controlId);
    if (!control) {
      throw new NotFoundException('Follow-up control not found.');
    }
    if (control.status !== 'ACTIVE') {
      throw new ForbiddenException('Only an active follow-up control can be released.');
    }

    const released = await this.controls.release(controlId, adminUserId, releaseReason, now);
    await this.audit.record({
      eventType: 'FOLLOW_UP_RELEASED',
      userId: control.userId,
      applicationId: control.applicationId,
      detail: `Admin override by ${adminUserId}: ${releaseReason}`,
    });
    return released;
  }

  async findActiveForApplication(applicationId: string): Promise<FollowUpControlRecord | null> {
    return this.controls.findActiveByApplicationId(applicationId);
  }
}
