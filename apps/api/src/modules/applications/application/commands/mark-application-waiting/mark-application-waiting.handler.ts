import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { MarkApplicationWaitingCommand } from './mark-application-waiting.command';
import { OperationalDecisionCommandHelper } from '../operational-decision-command.helper';
import { ApplicationOperationalDecisionRecord } from '../../../domain/models/application-operational-decision';

@CommandHandler(MarkApplicationWaitingCommand)
export class MarkApplicationWaitingHandler implements ICommandHandler<MarkApplicationWaitingCommand> {
  constructor(private readonly helper: OperationalDecisionCommandHelper) {}

  async execute(command: MarkApplicationWaitingCommand): Promise<ApplicationOperationalDecisionRecord> {
    return this.helper.record({
      applicationId: command.applicationId,
      decisionType: 'WAITING',
      actorType: command.actorRole,
      actorId: command.actorId,
      reason: command.reason,
      evidence: command.evidence,
      correlationId: command.correlationId ?? null,
      idempotencyKey: command.idempotencyKey,
    });
  }
}
