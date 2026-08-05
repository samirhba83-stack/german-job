import { BadRequestException, ConflictException, Inject } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import { ApplicationChannelType } from '@german-job-engine/shared-types';
import { CreateApplicationCommand } from './create-application.command';
import {
  APPLICATION_REPOSITORY,
  ApplicationRepository,
} from '../../../domain/repositories/application.repository.interface';
import { Application } from '../../../domain/entities/application.entity';
import { ApplicationSnapshot } from '../../../domain/value-objects/application-snapshot.vo';
import { ApplicationChannel } from '../../../domain/value-objects/application-channel.vo';
import { buildActor, resolveCorrelationId } from '../../application-command.helpers';
import { ApplicationReadModel } from '../../read-models/application.read-model';
import { ApplicationReadModelMapper } from '../../read-models/application-read-model.mapper';

@CommandHandler(CreateApplicationCommand)
export class CreateApplicationHandler implements ICommandHandler<CreateApplicationCommand> {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly applicationRepository: ApplicationRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateApplicationCommand): Promise<ApplicationReadModel> {
    const existingForCandidateAndJob = await this.applicationRepository.findByCandidateId(command.candidateId);
    if (existingForCandidateAndJob.some((application) => application.jobId === command.jobId && application.isActive())) {
      throw new ConflictException('An active application already exists for this candidate and job');
    }

    let application: Application;
    try {
      const actor = buildActor(command.actorRole, command.actorId);
      const correlationId = resolveCorrelationId(command.correlationId);
      const snapshot = ApplicationSnapshot.create(command.snapshot);
      const channel = ApplicationChannel.create(
        command.channelType ?? ApplicationChannelType.DIRECT,
        command.campaignRef,
      );

      application = Application.create(
        randomUUID(),
        command.candidateId,
        command.jobId,
        command.companyId,
        snapshot,
        channel,
        actor,
        correlationId,
      );
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid application data');
    }

    await this.applicationRepository.save(application);
    application.domainEvents.forEach((event) => this.eventBus.publish(event));
    application.clearDomainEvents();

    return ApplicationReadModelMapper.toReadModel(application);
  }
}
