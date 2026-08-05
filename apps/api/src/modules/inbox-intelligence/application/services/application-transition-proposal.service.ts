import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ActorRole, TransitionReasonCode } from '@german-job-engine/shared-types';
import { RegisterCompanyReplyCommand } from '../../../applications/application/commands/register-company-reply/register-company-reply.command';
import { ScheduleInterviewCommand } from '../../../applications/application/commands/schedule-interview/schedule-interview.command';
import { RejectApplicationCommand } from '../../../applications/application/commands/reject-application/reject-application.command';
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

/** M29 Phase 14 — the one, narrow, documented mapping from a reply classification to a proposed
 * operational action. Categories with no entry here (AUTOMATIC_REPLY, OUT_OF_OFFICE,
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
 * command, and ONLY for the three actions below whose underlying domain policy actually permits a
 * `SYSTEM` actor (`ResponsePolicy`/`InterviewPolicy`/`RejectionPolicy`, all confirmed to allow
 * SYSTEM). `OFFER_RECEIVED`'s real command (`ReceiveOfferCommand`) is deliberately never
 * dispatched here — `OfferPolicy` requires a real `COMPANY`-role actor, a pre-existing domain
 * business rule this module does not weaken or bypass; confirming an offer proposal records the
 * confirmation at the inbox-intelligence layer only, honestly, not a real Applications-side
 * transition (a named, documented limitation, not a silent gap).
 */
@Injectable()
export class ApplicationTransitionProposalService {
  private readonly logger = new Logger(ApplicationTransitionProposalService.name);

  constructor(
    @Inject(APPLICATION_TRANSITION_PROPOSAL_REPOSITORY) private readonly proposals: ApplicationTransitionProposalRepository,
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
    return proposal;
  }

  async confirmProposal(proposalId: string, userId: string): Promise<ApplicationTransitionProposalRecord> {
    const now = this.clock.now();
    const proposal = await this.proposals.findById(proposalId);
    if (!proposal) {
      throw new NotFoundException('Transition proposal not found.');
    }

    await this.dispatchRealCommandIfSupported(proposal.applicationId, proposal.proposedAction, proposal.correlationId);

    const updated = await this.proposals.markConfirmed(proposalId, userId, now);
    await this.audit.record({ eventType: 'APPLICATION_TRANSITION_CONFIRMED', userId, applicationId: proposal.applicationId, inboxMessageId: proposal.inboxMessageId, detail: `Confirmed ${proposal.proposedAction}.` });
    return updated;
  }

  async rejectProposal(proposalId: string, userId: string): Promise<ApplicationTransitionProposalRecord> {
    const now = this.clock.now();
    const proposal = await this.proposals.findById(proposalId);
    if (!proposal) {
      throw new NotFoundException('Transition proposal not found.');
    }
    const updated = await this.proposals.markRejected(proposalId, userId, now);
    await this.audit.record({ eventType: 'APPLICATION_TRANSITION_REJECTED', userId, applicationId: proposal.applicationId, inboxMessageId: proposal.inboxMessageId, detail: `Rejected ${proposal.proposedAction}.` });
    return updated;
  }

  /** Real command dispatch, ONLY for the three actions whose underlying domain policy accepts a
   * SYSTEM actor. Every other action (including `OFFER_RECEIVED`) is a documented no-op here — see
   * this class's own doc comment. */
  private async dispatchRealCommandIfSupported(applicationId: string, action: ProposedApplicationAction, correlationId: string | null): Promise<void> {
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
      case 'OFFER_RECEIVED':
      case 'DOCUMENTS_REQUESTED':
      case 'INFORMATION_REQUESTED':
      case 'ASSESSMENT_INVITED':
      case 'UNDER_REVIEW':
      case 'WAITING':
        this.logger.log(`Proposal action "${action}" confirmed at the inbox-intelligence layer only — no matching Applications-module command is dispatched (either none exists, or its domain policy does not permit a SYSTEM actor).`);
        return;
    }
  }
}
