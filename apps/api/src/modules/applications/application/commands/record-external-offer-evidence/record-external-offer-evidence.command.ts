import { ActorRole } from '@german-job-engine/shared-types';

/** M30 Phase 6 — deliberately NEVER dispatches `ReceiveOfferCommand` (that would require
 * fabricating a `COMPANY` actor, which `OfferPolicy` correctly refuses — a pre-existing domain
 * rule this milestone does not weaken or bypass). Records the offer evidence and lets
 * `RecruitmentTaskService` create a `REVIEW_OFFER` task instead — the real `Application.status`
 * only ever reaches `OFFER_RECEIVED` through a genuine `ReceiveOfferCommand` dispatched by the
 * COMPANY actor themselves, exactly as before this milestone. */
export class RecordExternalOfferEvidenceCommand {
  constructor(
    public readonly applicationId: string,
    public readonly actorRole: ActorRole,
    public readonly actorId: string | null,
    public readonly reason: string | null,
    public readonly evidence: Readonly<Record<string, unknown>> | null,
    public readonly idempotencyKey: string,
    public readonly correlationId?: string,
  ) {}
}
