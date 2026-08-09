import { Inject, Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ActorRole, TransitionReasonCode } from '@german-job-engine/shared-types';
import { RegisterCompanyReplyCommand } from '../../../applications/application/commands/register-company-reply/register-company-reply.command';
import { ScheduleInterviewCommand } from '../../../applications/application/commands/schedule-interview/schedule-interview.command';
import { RejectApplicationCommand } from '../../../applications/application/commands/reject-application/reject-application.command';
import { RecordDocumentRequestCommand } from '../../../applications/application/commands/record-document-request/record-document-request.command';
import { RecordInformationRequestCommand } from '../../../applications/application/commands/record-information-request/record-information-request.command';
import { RecordAssessmentInvitationCommand } from '../../../applications/application/commands/record-assessment-invitation/record-assessment-invitation.command';
import { MarkApplicationUnderReviewCommand } from '../../../applications/application/commands/mark-application-under-review/mark-application-under-review.command';
import { MarkApplicationWaitingCommand } from '../../../applications/application/commands/mark-application-waiting/mark-application-waiting.command';
import { RecordExternalOfferEvidenceCommand } from '../../../applications/application/commands/record-external-offer-evidence/record-external-offer-evidence.command';
import { APPLICATION_REPOSITORY, ApplicationRepository } from '../../../applications/domain/repositories/application.repository.interface';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import {
  ApplicationTransitionProposalRepository,
  APPLICATION_TRANSITION_PROPOSAL_REPOSITORY,
} from '../../domain/ports/application-transition-proposal.repository';
import { ApplicationTransitionProposalRecord, ProposedApplicationAction } from '../../domain/models/application-transition-proposal';
import { ReplyPrimaryCategory } from '../../domain/models/reply-taxonomy';
import { ExtractedRecruitmentFacts } from '../../domain/models/extracted-facts';

const SYSTEM_ACTOR_ID = 'inbox-intelligence';

/** M29 Phase 14 / M30 Phase 6 — the one, narrow, documented mapping from a reply classification to
 * a proposed operational action. Categories with no entry here (AUTOMATIC_REPLY, OUT_OF_OFFICE,
 * DELIVERY_FAILURE — Phase 12's own "not candidate employment outcome" carve-out, already handled
 * by M28's delivery tracking — SPAM_OR_UNRELATED, NEEDS_MANUAL_REVIEW, UNKNOWN,
 * WITHDRAWAL_CONFIRMATION, REFERRAL_TO_OTHER_POSITION) never propose a transition at all — the
 * classification is still recorded and the user is still notified where relevant, just with no
 * transition proposal attached. */
const CATEGORY_TO_ACTION: Readonly<Partial<Record<ReplyPrimaryCategory, ProposedApplicationAction>>> = {
  INTERVIEW_INVITATION: 'INTERVIEW_INVITED',
  ACCEPTANCE_OR_OFFER: 'OFFER_RECEIVED',
  REJECTION: 'REJECTED',
  DOCUMENT_REQUEST: 'DOCUMENTS_REQUESTED',
  INFORMATION_REQUEST: 'INFORMATION_REQUESTED',
  AVAILABILITY_REQUEST: 'INFORMATION_REQUESTED',
  ASSESSMENT_OR_TEST_INVITATION: 'ASSESSMENT_INVITED',
  APPLICATION_RECEIVED_CONFIRMATION: 'REPLY_RECEIVED',
  APPLICATION_UNDER_REVIEW: 'UNDER_REVIEW',
  WAITLIST_OR_DELAY: 'WAITING',
};

export interface CreateProposalInput {
  readonly inboxMessageId: string;
  readonly applicationId: string;
  readonly category: ReplyPrimaryCategory;
  readonly confidence: number;
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly extractedFacts: ExtractedRecruitmentFacts;
  readonly correlationId: string | null;
}

/**
 * M29 Phase 14 — "do not directly mutate status tables from inbox code": every proposed lifecycle
 * change is persisted as its own row first; only `confirmProposal()` (an explicit user action, or
 * the future automated case per `ReplyDecisionPolicy`) ever dispatches a real Applications-module
 * command. `OFFER_RECEIVED`'s real command (`ReceiveOfferCommand`) is deliberately never
 * dispatched here — `OfferPolicy` requires a real `COMPANY`-role actor, a pre-existing domain
 * business rule this module does not weaken or bypass; confirming an offer proposal records the
 * confirmation at the inbox-intelligence layer plus a real `RecordExternalOfferEvidenceCommand`
 * (M30), never a real Applications-side `OFFER_RECEIVED` transition.
 *
 * M30 Phase 7 — `confirmProposal()`/`rejectProposal()` now: (1) verify the requesting user owns
 * the underlying application (a REAL, previously-missing check — any authenticated user could
 * confirm/reject any other user's proposal before this fix, since `ApplicationTransitionProposal`
 * carries no `userId` of its own to check against the JWT-authenticated caller); (2) claim the
 * proposal via an atomic, DB-guarded `PENDING -> CONFIRMED`/`PENDING -> REJECTED` transition
 * (`ApplicationTransitionProposalRepository.tryTransition()`) — the real "exactly-once execution"
 * guarantee; a plain read-then-write `status === 'PENDING'` check alone (an earlier version of
 * this fix) is a TOCTOU race under real concurrency, so the actual guard is the conditional
 * `updateMany` + affected-row-count idiom this codebase already uses for `EmailMessage` queue
 * claims — only the caller whose conditional update actually matches a row proceeds to dispatch
 * the underlying command; every other concurrent caller gets a real 409, never a second dispatch;
 * (3) if the underlying domain command rejects the transition because the application's real state
 * has since moved on (e.g. a newer reply already rejected the application before this older
 * proposal was confirmed), the already-claimed row is transitioned to REJECTED (stale,
 * `APPLICATION_PROPOSAL_STALE`) and a 409 is returned; a genuinely unexpected (non-domain-guard)
 * dispatch failure instead releases the claim back to PENDING so the proposal stays real and
 * retryable — never left showing CONFIRMED for a command that didn't actually succeed. Never a raw
 * 500 on the expected stale case, never a silent no-op either way.
 */
@Injectable()
export class ApplicationTransitionProposalService {
  private readonly logger = new Logger(ApplicationTransitionProposalService.name);

  constructor(
    @Inject(APPLICATION_TRANSITION_PROPOSAL_REPOSITORY) private readonly proposals: ApplicationTransitionProposalRepository,
    @Inject(APPLICATION_REPOSITORY) private readonly applications: ApplicationRepository,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly commandBus: CommandBus,
    private readonly audit: EmailSecurityAuditService,
  ) {}

  mapCategoryToAction(category: ReplyPrimaryCategory): ProposedApplicationAction | null {
    return CATEGORY_TO_ACTION[category] ?? null;
  }

  async createProposal(input: CreateProposalInput, userId: string): Promise<ApplicationTransitionProposalRecord | null> {
    const action = this.mapCategoryToAction(input.category);
    if (!action) return null;

    const now = this.clock.now();
    const proposal = await this.proposals.create(
      {
        inboxMessageId: input.inboxMessageId,
        applicationId: input.applicationId,
        proposedAction: action,
        classification: input.category,
        confidence: input.confidence,
        evidence: input.evidence,
        actorType: 'SYSTEM',
        correlationId: input.correlationId,
      },
      now,
    );
    await this.audit.record({
      eventType: 'APPLICATION_TRANSITION_PROPOSED',
      userId,
      applicationId: input.applicationId,
      inboxMessageId: input.inboxMessageId,
      detail: `Proposed ${action} from a ${input.category} classification (confidence ${input.confidence.toFixed(2)}).`,
    });
    await this.audit.record({ eventType: 'APPLICATION_COMMAND_PROPOSED', userId, applicationId: input.applicationId, inboxMessageId: input.inboxMessageId, detail: `Proposed action: ${action}.` });
    return proposal;
  }

  async confirmProposal(proposalId: string, userId: string): Promise<ApplicationTransitionProposalRecord> {
    const now = this.clock.now();
    const proposal = await this.requireOwnedPendingProposal(proposalId, userId);

    // Atomic, DB-guarded claim — the real "exactly-once execution" guarantee (Phase 7).
    // `requireOwnedPendingProposal()` above is a fast-path ownership/existence/friendly-error
    // check; the real race protection is here: only whichever concurrent caller's conditional
    // `PENDING -> CONFIRMED` update actually matches a row proceeds to dispatch the real command.
    // A second, concurrent caller's claim attempt gets `null` and a real 409 — never a second
    // dispatch of the same underlying domain command.
    const claimed = await this.proposals.tryTransition(proposalId, 'PENDING', 'CONFIRMED', userId, now);
    if (!claimed) {
      throw new ConflictException('This suggestion has already been handled.');
    }

    try {
      await this.dispatchRealCommandIfSupported(proposal.applicationId, proposal.proposedAction, proposal.correlationId);
    } catch (error) {
      // A real domain transition-guard rejection (the application's state moved on since this
      // proposal was created) is an expected, handled outcome — never let it surface as a raw
      // 500. We already own this row exclusively (the claim above succeeded), so the transition
      // out of CONFIRMED below is not itself racing anyone.
      const message = error instanceof Error ? error.message : 'Unknown error executing the underlying command.';
      if (this.looksLikeStateConflict(error)) {
        await this.proposals.tryTransition(proposalId, 'CONFIRMED', 'REJECTED', userId, now);
        await this.audit.record({ eventType: 'APPLICATION_PROPOSAL_STALE', userId, applicationId: proposal.applicationId, inboxMessageId: proposal.inboxMessageId, detail: `Stale — application state no longer permits ${proposal.proposedAction}: ${message}` });
        throw new ConflictException(`This suggestion is no longer valid — the application's status has since changed. (${message})`);
      }
      // A genuinely unexpected failure (not a domain state conflict) — release the claim back to
      // PENDING so the proposal stays real and retryable, never stuck showing CONFIRMED for a
      // command that never actually succeeded (never represent a proposed action as completed).
      await this.proposals.tryTransition(proposalId, 'CONFIRMED', 'PENDING', userId, now);
      await this.audit.record({ eventType: 'APPLICATION_COMMAND_FAILED', userId, applicationId: proposal.applicationId, inboxMessageId: proposal.inboxMessageId, detail: `${proposal.proposedAction} failed: ${message}` });
      throw error;
    }

    await this.audit.record({ eventType: 'APPLICATION_TRANSITION_CONFIRMED', userId, applicationId: proposal.applicationId, inboxMessageId: proposal.inboxMessageId, detail: `Confirmed ${proposal.proposedAction}.` });
    await this.audit.record({ eventType: 'APPLICATION_COMMAND_CONFIRMED', userId, applicationId: proposal.applicationId, inboxMessageId: proposal.inboxMessageId, detail: `Confirmed ${proposal.proposedAction}.` });
    return claimed;
  }

  async rejectProposal(proposalId: string, userId: string): Promise<ApplicationTransitionProposalRecord> {
    const now = this.clock.now();
    const proposal = await this.requireOwnedPendingProposal(proposalId, userId);
    // Same atomic guard as confirmProposal() — a reject racing a concurrent confirm (or a second
    // concurrent reject) for the same proposal resolves to exactly one winner at the DB level.
    const updated = await this.proposals.tryTransition(proposalId, 'PENDING', 'REJECTED', userId, now);
    if (!updated) {
      throw new ConflictException('This suggestion has already been handled.');
    }
    await this.audit.record({ eventType: 'APPLICATION_TRANSITION_REJECTED', userId, applicationId: proposal.applicationId, inboxMessageId: proposal.inboxMessageId, detail: `Rejected ${proposal.proposedAction}.` });
    await this.audit.record({ eventType: 'APPLICATION_COMMAND_REJECTED', userId, applicationId: proposal.applicationId, inboxMessageId: proposal.inboxMessageId, detail: `Rejected ${proposal.proposedAction}.` });
    return updated;
  }

  /** Phase 7 — ownership + PENDING-only, both real checks that were previously missing entirely
   * (any authenticated user could act on any proposal). Same "never reveal whether the id exists
   * for someone else" anti-enumeration shape as `InboxIntelligenceController.requireOwnedMessage()`. */
  private async requireOwnedPendingProposal(proposalId: string, userId: string): Promise<ApplicationTransitionProposalRecord> {
    const proposal = await this.proposals.findById(proposalId);
    if (!proposal) {
      throw new NotFoundException('Transition proposal not found.');
    }
    const application = await this.applications.findById(proposal.applicationId);
    if (!application || application.candidateId !== userId) {
      throw new NotFoundException('Transition proposal not found.');
    }
    if (proposal.status !== 'PENDING') {
      throw new ConflictException('This suggestion has already been handled.');
    }
    return proposal;
  }

  /** A real domain transition-guard exception (`mapTransitionError`'s own mapped exceptions in the
   * Applications module) always carries a message describing an invalid state transition — this
   * is a pragmatic, real-world distinction between "the command was structurally rejected because
   * the application moved on" (stale, expected) vs. "something actually broke" (a real failure),
   * without this module needing to import the Applications module's internal exception classes
   * (would be a needless coupling for a message-shape check alone). */
  private looksLikeStateConflict(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const name = error.constructor?.name ?? '';
    return name.includes('BadRequest') || name.includes('Conflict') || name.includes('InvalidTransition') || /transition|status|state/i.test(error.message);
  }

  /** Real command dispatch, ONLY for the actions whose underlying domain policy accepts a SYSTEM
   * actor, or (M30) whose additive operational-decision command never needs one. `OFFER_RECEIVED`
   * dispatches `RecordExternalOfferEvidenceCommand` — never the real `ReceiveOfferCommand`, which
   * `OfferPolicy` restricts to a genuine `COMPANY` actor (see this class's own doc comment). */
  private async dispatchRealCommandIfSupported(applicationId: string, action: ProposedApplicationAction, correlationId: string | null): Promise<void> {
    const idempotencyKey = `transition-proposal:${applicationId}:${action}:${correlationId ?? 'manual'}`;
    switch (action) {
      case 'REPLY_RECEIVED':
        await this.commandBus.execute(new RegisterCompanyReplyCommand(applicationId, ActorRole.SYSTEM, SYSTEM_ACTOR_ID, correlationId ?? undefined, TransitionReasonCode.SYSTEM_SIGNAL, 'Detected via connected mailbox reply (Inbox Intelligence).'));
        return;
      case 'INTERVIEW_INVITED':
        await this.commandBus.execute(new ScheduleInterviewCommand(applicationId, ActorRole.SYSTEM, SYSTEM_ACTOR_ID, { source: 'inbox-intelligence' }, correlationId ?? undefined));
        return;
      case 'REJECTED':
        await this.commandBus.execute(new RejectApplicationCommand(applicationId, ActorRole.SYSTEM, SYSTEM_ACTOR_ID, TransitionReasonCode.SYSTEM_SIGNAL, 'Detected via connected mailbox reply (Inbox Intelligence).', correlationId ?? undefined));
        return;
      case 'DOCUMENTS_REQUESTED':
        await this.commandBus.execute(new RecordDocumentRequestCommand(applicationId, ActorRole.SYSTEM, SYSTEM_ACTOR_ID, 'Detected via connected mailbox reply (Inbox Intelligence).', null, idempotencyKey, correlationId ?? undefined));
        return;
      case 'INFORMATION_REQUESTED':
        await this.commandBus.execute(new RecordInformationRequestCommand(applicationId, ActorRole.SYSTEM, SYSTEM_ACTOR_ID, 'Detected via connected mailbox reply (Inbox Intelligence).', null, idempotencyKey, correlationId ?? undefined));
        return;
      case 'ASSESSMENT_INVITED':
        await this.commandBus.execute(new RecordAssessmentInvitationCommand(applicationId, ActorRole.SYSTEM, SYSTEM_ACTOR_ID, 'Detected via connected mailbox reply (Inbox Intelligence).', null, idempotencyKey, correlationId ?? undefined));
        return;
      case 'UNDER_REVIEW':
        await this.commandBus.execute(new MarkApplicationUnderReviewCommand(applicationId, ActorRole.SYSTEM, SYSTEM_ACTOR_ID, 'Detected via connected mailbox reply (Inbox Intelligence).', null, idempotencyKey, correlationId ?? undefined));
        return;
      case 'WAITING':
        await this.commandBus.execute(new MarkApplicationWaitingCommand(applicationId, ActorRole.SYSTEM, SYSTEM_ACTOR_ID, 'Detected via connected mailbox reply (Inbox Intelligence).', null, idempotencyKey, correlationId ?? undefined));
        return;
      case 'OFFER_RECEIVED':
        this.logger.log('OFFER_RECEIVED confirmed — recording external offer evidence only; the real Applications-side OFFER_RECEIVED status still requires the company\'s own ReceiveOfferCommand (OfferPolicy is never bypassed).');
        await this.commandBus.execute(new RecordExternalOfferEvidenceCommand(applicationId, ActorRole.SYSTEM, SYSTEM_ACTOR_ID, 'Detected via connected mailbox reply (Inbox Intelligence).', null, idempotencyKey, correlationId ?? undefined));
        return;
    }
  }
}
