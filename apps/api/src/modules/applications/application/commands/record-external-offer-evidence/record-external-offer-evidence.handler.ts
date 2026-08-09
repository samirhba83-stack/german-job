import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecordExternalOfferEvidenceCommand } from './record-external-offer-evidence.command';
import { OperationalDecisionCommandHelper } from '../operational-decision-command.helper';
import { ApplicationOperationalDecisionRecord } from '../../../domain/models/application-operational-decision';

@CommandHandler(RecordExternalOfferEvidenceCommand)
export class RecordExternalOfferEvidenceHandler implements ICommandHandler<RecordExternalOfferEvidenceCommand> {
  constructor(private readonly helper: OperationalDecisionCommandHelper) {}

  async execute(command: RecordExternalOfferEvidenceCommand): Promise<ApplicationOperationalDecisionRecord> {
    return this.helper.record({
      applicationId: command.applicationId,
      decisionType: 'OFFER_EVIDENCE_RECORDED',
      actorType: command.actorRole,
      actorId: command.actorId,
      reason: command.reason,
      evidence: command.evidence,
      correlationId: command.correlationId ?? null,
      idempotencyKey: command.idempotencyKey,
    });
  }
}
