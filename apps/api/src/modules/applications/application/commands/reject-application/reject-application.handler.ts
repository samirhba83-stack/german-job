import { Inject } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { RejectApplicationCommand } from './reject-application.command';
import {
  APPLICATION_REPOSITORY,
  ApplicationRepository,
} from '../../../domain/repositories/application.repository.interface';
import { TransitionReason } from '../../../domain/value-objects/transition-reason.vo';
import {
  assertActorOwnsCompany,
  buildActor,
  loadApplicationOrThrow,
  mapTransitionError,
  resolveCorrelationId,
  saveAndPublish,
} from '../../application-command.helpers';
import { ApplicationReadModel } from '../../read-models/application.read-model';
import { ApplicationReadModelMapper } from '../../read-models/application-read-model.mapper';
import { COMPANY_REPOSITORY, CompanyRepository } from '../../../../companies/domain/repositories/company.repository.interface';

@CommandHandler(RejectApplicationCommand)
export class RejectApplicationHandler implements ICommandHandler<RejectApplicationCommand> {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly applicationRepository: ApplicationRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: CompanyRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RejectApplicationCommand): Promise<ApplicationReadModel> {
    const application = await loadApplicationOrThrow(this.applicationRepository, command.applicationId);
    await assertActorOwnsCompany(this.companyRepository, application.companyId, command.actorRole, command.actorId);
    const actor = buildActor(command.actorRole, command.actorId);
    const correlationId = resolveCorrelationId(command.correlationId);
    const reason = TransitionReason.create(command.reasonCode, command.reasonNote);

    try {
      application.reject(actor, correlationId, reason);
    } catch (error) {
      mapTransitionError(error);
    }

    await saveAndPublish(this.applicationRepository, this.eventBus, application);
    return ApplicationReadModelMapper.toReadModel(application);
  }
}
