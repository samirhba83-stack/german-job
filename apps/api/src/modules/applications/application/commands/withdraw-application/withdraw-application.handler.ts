import { Inject } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { WithdrawApplicationCommand } from './withdraw-application.command';
import {
  APPLICATION_REPOSITORY,
  ApplicationRepository,
} from '../../../domain/repositories/application.repository.interface';
import { TransitionReason } from '../../../domain/value-objects/transition-reason.vo';
import {
  buildActor,
  loadApplicationOrThrow,
  mapTransitionError,
  resolveCorrelationId,
  saveAndPublish,
} from '../../application-command.helpers';
import { ApplicationReadModel } from '../../read-models/application.read-model';
import { ApplicationReadModelMapper } from '../../read-models/application-read-model.mapper';

@CommandHandler(WithdrawApplicationCommand)
export class WithdrawApplicationHandler implements ICommandHandler<WithdrawApplicationCommand> {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly applicationRepository: ApplicationRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: WithdrawApplicationCommand): Promise<ApplicationReadModel> {
    const application = await loadApplicationOrThrow(this.applicationRepository, command.applicationId);
    const actor = buildActor(command.actorRole, command.actorId);
    const correlationId = resolveCorrelationId(command.correlationId);
    const reason = TransitionReason.create(command.reasonCode, command.reasonNote);

    try {
      application.withdraw(actor, correlationId, reason);
    } catch (error) {
      mapTransitionError(error);
    }

    await saveAndPublish(this.applicationRepository, this.eventBus, application);
    return ApplicationReadModelMapper.toReadModel(application);
  }
}
