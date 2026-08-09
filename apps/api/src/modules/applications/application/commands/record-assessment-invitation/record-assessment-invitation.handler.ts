import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecordAssessmentInvitationCommand } from './record-assessment-invitation.command';
import { OperationalDecisionCommandHelper } from '../operational-decision-command.helper';
import { ApplicationOperationalDecisionRecord } from '../../../domain/models/application-operational-decision';

@CommandHandler(RecordAssessmentInvitationCommand)
export class RecordAssessmentInvitationHandler implements ICommandHandler<RecordAssessmentInvitationCommand> {
  constructor(private readonly helper: OperationalDecisionCommandHelper) {}

  async execute(command: RecordAssessmentInvitationCommand): Promise<ApplicationOperationalDecisionRecord> {
    return this.helper.record({
      applicationId: command.applicationId,
      decisionType: 'ASSESSMENT_INVITED',
      actorType: command.actorRole,
      actorId: command.actorId,
      reason: command.reason,
      evidence: command.evidence,
      correlationId: command.correlationId ?? null,
      idempotencyKey: command.idempotencyKey,
    });
  }
}
