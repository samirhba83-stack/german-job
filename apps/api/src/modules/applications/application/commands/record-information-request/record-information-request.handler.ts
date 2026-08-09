import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecordInformationRequestCommand } from './record-information-request.command';
import { OperationalDecisionCommandHelper } from '../operational-decision-command.helper';
import { ApplicationOperationalDecisionRecord } from '../../../domain/models/application-operational-decision';

@CommandHandler(RecordInformationRequestCommand)
export class RecordInformationRequestHandler implements ICommandHandler<RecordInformationRequestCommand> {
  constructor(private readonly helper: OperationalDecisionCommandHelper) {}

  async execute(command: RecordInformationRequestCommand): Promise<ApplicationOperationalDecisionRecord> {
    return this.helper.record({
      applicationId: command.applicationId,
      decisionType: 'INFORMATION_REQUESTED',
      actorType: command.actorRole,
      actorId: command.actorId,
      reason: command.reason,
      evidence: command.evidence,
      correlationId: command.correlationId ?? null,
      idempotencyKey: command.idempotencyKey,
    });
  }
}
