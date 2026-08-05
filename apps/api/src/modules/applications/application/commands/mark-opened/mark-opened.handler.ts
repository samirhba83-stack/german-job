import { BadRequestException, Inject } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { MarkOpenedCommand } from './mark-opened.command';
import {
  APPLICATION_REPOSITORY,
  ApplicationRepository,
} from '../../../domain/repositories/application.repository.interface';
import { EvidenceReference } from '../../../domain/value-objects/evidence-reference.vo';
import { ConfidenceScore } from '../../../domain/value-objects/confidence-score.vo';
import { Actor } from '../../../domain/value-objects/actor.vo';
import {
  loadApplicationOrThrow,
  mapTransitionError,
  resolveCorrelationId,
  saveAndPublish,
} from '../../application-command.helpers';
import { ApplicationReadModel } from '../../read-models/application.read-model';
import { ApplicationReadModelMapper } from '../../read-models/application-read-model.mapper';

@CommandHandler(MarkOpenedCommand)
export class MarkOpenedHandler implements ICommandHandler<MarkOpenedCommand> {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly applicationRepository: ApplicationRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: MarkOpenedCommand): Promise<ApplicationReadModel> {
    const application = await loadApplicationOrThrow(this.applicationRepository, command.applicationId);
    const correlationId = resolveCorrelationId(command.correlationId);
    const actor = Actor.system('open-tracking-webhook');

    let evidence: EvidenceReference;
    let confidence: ConfidenceScore;
    try {
      evidence = EvidenceReference.create({
        type: command.evidenceType,
        externalId: command.evidenceExternalId,
        url: command.evidenceUrl,
      });
      confidence = ConfidenceScore.create(command.confidence);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid open evidence');
    }

    try {
      application.markOpened(actor, correlationId, evidence, confidence);
    } catch (error) {
      mapTransitionError(error);
    }

    await saveAndPublish(this.applicationRepository, this.eventBus, application);
    return ApplicationReadModelMapper.toReadModel(application);
  }
}
