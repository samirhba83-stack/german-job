import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecordDocumentRequestCommand } from './record-document-request.command';
import { OperationalDecisionCommandHelper } from '../operational-decision-command.helper';
import { ApplicationOperationalDecisionRecord } from '../../../domain/models/application-operational-decision';

@CommandHandler(RecordDocumentRequestCommand)
export class RecordDocumentRequestHandler implements ICommandHandler<RecordDocumentRequestCommand> {
  constructor(private readonly helper: OperationalDecisionCommandHelper) {}

  async execute(command: RecordDocumentRequestCommand): Promise<ApplicationOperationalDecisionRecord> {
    return this.helper.record({
      applicationId: command.applicationId,
      decisionType: 'DOCUMENTS_REQUESTED',
      actorType: command.actorRole,
      actorId: command.actorId,
      reason: command.reason,
      evidence: command.evidence,
      correlationId: command.correlationId ?? null,
      idempotencyKey: command.idempotencyKey,
    });
  }
}
