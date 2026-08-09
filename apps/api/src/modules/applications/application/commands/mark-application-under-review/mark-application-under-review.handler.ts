import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { MarkApplicationUnderReviewCommand } from './mark-application-under-review.command';
import { OperationalDecisionCommandHelper } from '../operational-decision-command.helper';
import { ApplicationOperationalDecisionRecord } from '../../../domain/models/application-operational-decision';

@CommandHandler(MarkApplicationUnderReviewCommand)
export class MarkApplicationUnderReviewHandler implements ICommandHandler<MarkApplicationUnderReviewCommand> {
  constructor(private readonly helper: OperationalDecisionCommandHelper) {}

  async execute(command: MarkApplicationUnderReviewCommand): Promise<ApplicationOperationalDecisionRecord> {
    return this.helper.record({
      applicationId: command.applicationId,
      decisionType: 'UNDER_REVIEW',
      actorType: command.actorRole,
      actorId: command.actorId,
      reason: command.reason,
      evidence: command.evidence,
      correlationId: command.correlationId ?? null,
      idempotencyKey: command.idempotencyKey,
    });
  }
}
