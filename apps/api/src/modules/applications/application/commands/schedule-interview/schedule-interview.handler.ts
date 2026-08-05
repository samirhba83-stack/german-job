import { BadRequestException, Inject } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { ScheduleInterviewCommand } from './schedule-interview.command';
import {
  APPLICATION_REPOSITORY,
  ApplicationRepository,
} from '../../../domain/repositories/application.repository.interface';
import { Metadata } from '../../../domain/value-objects/metadata.vo';
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

@CommandHandler(ScheduleInterviewCommand)
export class ScheduleInterviewHandler implements ICommandHandler<ScheduleInterviewCommand> {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly applicationRepository: ApplicationRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: CompanyRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ScheduleInterviewCommand): Promise<ApplicationReadModel> {
    const application = await loadApplicationOrThrow(this.applicationRepository, command.applicationId);
    await assertActorOwnsCompany(this.companyRepository, application.companyId, command.actorRole, command.actorId);
    const actor = buildActor(command.actorRole, command.actorId);
    const correlationId = resolveCorrelationId(command.correlationId);

    let metadata: Metadata;
    try {
      metadata = Metadata.create(command.metadata);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid interview metadata');
    }

    try {
      application.scheduleInterview(actor, correlationId, metadata);
    } catch (error) {
      mapTransitionError(error);
    }

    await saveAndPublish(this.applicationRepository, this.eventBus, application);
    return ApplicationReadModelMapper.toReadModel(application);
  }
}
