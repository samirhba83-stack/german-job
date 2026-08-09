/** M30 Phase 6 — additive-only operational signals for the proposed application actions that have
 * no real `ApplicationLifecycleStatus` slot (Phase 1 audit: the 15-value lifecycle enum and its
 * transition graph is a deliberately closed set — adding new lifecycle states would be a real
 * domain state-machine change, out of this milestone's autonomous scope). These NEVER touch
 * `Application.status` — a parallel, additive record of a real operational signal, exactly the
 * Phase 18 "ApplicationOperationalDecision" concept the brief itself names. */
export type ApplicationOperationalDecisionType = 'DOCUMENTS_REQUESTED' | 'INFORMATION_REQUESTED' | 'ASSESSMENT_INVITED' | 'UNDER_REVIEW' | 'WAITING' | 'OFFER_EVIDENCE_RECORDED';

export interface ApplicationOperationalDecisionRecord {
  readonly id: string;
  readonly applicationId: string;
  readonly decisionType: ApplicationOperationalDecisionType;
  readonly actorType: string;
  readonly actorId: string | null;
  readonly reason: string | null;
  readonly evidence: Readonly<Record<string, unknown>> | null;
  readonly correlationId: string | null;
  readonly createdAt: Date;
  readonly idempotencyKey: string;
}

export interface RecordOperationalDecisionInput {
  readonly applicationId: string;
  readonly decisionType: ApplicationOperationalDecisionType;
  readonly actorType: string;
  readonly actorId: string | null;
  readonly reason: string | null;
  readonly evidence: Readonly<Record<string, unknown>> | null;
  readonly correlationId: string | null;
  readonly idempotencyKey: string;
}
