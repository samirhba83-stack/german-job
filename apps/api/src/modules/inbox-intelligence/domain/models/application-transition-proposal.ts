import { ReplyPrimaryCategory } from './reply-taxonomy';

/** M29 Phase 14 — the real set of proposed operational signals a matched reply can suggest. Not
 * all of these map 1:1 onto `ApplicationLifecycleStatus` (e.g. DOCUMENTS_REQUESTED is an
 * operational signal, not itself a lifecycle status) — `ApplicationTransitionProposalService`
 * owns the (documented, narrow) mapping from this enum to the real transition commands that
 * exist. */
export type ProposedApplicationAction =
  | 'REPLY_RECEIVED'
  | 'INTERVIEW_INVITED'
  | 'DOCUMENTS_REQUESTED'
  | 'INFORMATION_REQUESTED'
  | 'ASSESSMENT_INVITED'
  | 'UNDER_REVIEW'
  | 'REJECTED'
  | 'OFFER_RECEIVED'
  | 'WAITING';

export type ApplicationTransitionProposalStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

/** M29 Phase 14 — "do not directly mutate status tables from inbox code": every proposed
 * lifecycle change is recorded here FIRST; only a real, explicit user confirmation (or, for the
 * narrow deterministic-delivery-failure case, an automated confirm) causes the Applications
 * module's own existing transition command/handler to actually run. */
export interface ApplicationTransitionProposalRecord {
  readonly id: string;
  readonly inboxMessageId: string;
  readonly applicationId: string;
  readonly proposedAction: ProposedApplicationAction;
  readonly classification: ReplyPrimaryCategory | null;
  readonly confidence: number | null;
  readonly evidence: Readonly<Record<string, unknown>> | null;
  readonly actorType: string;
  readonly status: ApplicationTransitionProposalStatus;
  readonly confirmedByUserId: string | null;
  readonly confirmedAt: Date | null;
  readonly rejectedByUserId: string | null;
  readonly rejectedAt: Date | null;
  readonly correlationId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateApplicationTransitionProposalInput {
  readonly inboxMessageId: string;
  readonly applicationId: string;
  readonly proposedAction: ProposedApplicationAction;
  readonly classification: ReplyPrimaryCategory | null;
  readonly confidence: number | null;
  readonly evidence: Readonly<Record<string, unknown>> | null;
  readonly actorType: string;
  readonly correlationId: string | null;
}
