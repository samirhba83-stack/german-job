import { Inject, Injectable } from '@nestjs/common';
import { InboxMessageRepository, INBOX_MESSAGE_REPOSITORY } from '../../../inbox-intelligence/domain/ports/inbox-message.repository';
import {
  ApplicationTransitionProposalRepository,
  APPLICATION_TRANSITION_PROPOSAL_REPOSITORY,
} from '../../../inbox-intelligence/domain/ports/application-transition-proposal.repository';
import { FollowUpControlRepository, FOLLOW_UP_CONTROL_REPOSITORY } from '../../../recruitment-operations/domain/ports/follow-up-control.repository';
import { RecruitmentTaskRepository, RECRUITMENT_TASK_REPOSITORY } from '../../../recruitment-operations/domain/ports/recruitment-task.repository';
import { ReplyFollowUpOverview } from '../../domain/models/reply-followup-overview';

/**
 * M30 Phase 11 — see `reply-followup-overview.ts`'s own doc comment for why this is a deliberate,
 * documented exception to Mission Control's original "ExecutionEventQueryService only" rule.
 * Read-only across four real repositories, scoped to a single `applicationId` the caller already
 * owns/has verified access to (this service performs no authorization itself — same "the
 * caller's controller already checked ownership" convention every other Mission Control
 * projection follows for its own campaignId parameter).
 */
@Injectable()
export class ReplyFollowUpProjectionService {
  constructor(
    @Inject(INBOX_MESSAGE_REPOSITORY) private readonly inboxMessages: InboxMessageRepository,
    @Inject(APPLICATION_TRANSITION_PROPOSAL_REPOSITORY) private readonly proposals: ApplicationTransitionProposalRepository,
    @Inject(FOLLOW_UP_CONTROL_REPOSITORY) private readonly followUpControls: FollowUpControlRepository,
    @Inject(RECRUITMENT_TASK_REPOSITORY) private readonly tasks: RecruitmentTaskRepository,
  ) {}

  async getOverview(applicationId: string, userId: string): Promise<ReplyFollowUpOverview> {
    const [messages, allProposals, activeControl, openTasks] = await Promise.all([
      this.inboxMessages.list({ correlatedApplicationId: applicationId }, 1, 0),
      this.proposals.listByApplicationId(applicationId),
      this.followUpControls.findActiveByApplicationId(applicationId),
      this.tasks.list({ userId, applicationId, status: 'OPEN' }, 50, 0),
    ]);

    const latestReply = messages[0] ?? null;
    const pendingProposal = allProposals.find((p) => p.status === 'PENDING') ?? null;

    return {
      applicationId,
      latestReply: latestReply
        ? {
            inboxMessageId: latestReply.id,
            fromAddress: latestReply.fromAddress,
            subject: latestReply.subject,
            receivedAt: latestReply.receivedAt,
            primaryCategory: latestReply.primaryCategory,
            confidence: latestReply.classificationConfidence,
          }
        : null,
      activeFollowUpControl: activeControl
        ? {
            controlType: activeControl.controlType,
            reasonCode: activeControl.reasonCode,
            explanation: activeControl.explanation,
            expiresAt: activeControl.expiresAt,
          }
        : null,
      pendingTransitionProposal: pendingProposal ? { id: pendingProposal.id, proposedAction: pendingProposal.proposedAction, confidence: pendingProposal.confidence } : null,
      openTasks: openTasks.map((task) => ({ id: task.id, taskType: task.taskType, title: task.title, dueAt: task.dueAt, dueDateConfidence: task.dueDateConfidence })),
    };
  }
}
