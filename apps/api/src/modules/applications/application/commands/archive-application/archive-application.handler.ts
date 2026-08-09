import { Inject } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { ArchiveApplicationCommand } from './archive-application.command';
import {
  APPLICATION_REPOSITORY,
  ApplicationRepository,
} from '../../../domain/repositories/application.repository.interface';
import { TransitionReason } from '../../../domain/value-objects/transition-reason.vo';
import {
  assertCanAccessApplication,
  buildActor,
  loadApplicationOrThrow,
  mapTransitionError,
  resolveCorrelationId,
  saveAndPublish,
} from '../../application-command.helpers';
import { ApplicationReadModel } from '../../read-models/application.read-model';
import { ApplicationReadModelMapper } from '../../read-models/application-read-model.mapper';
import { COMPANY_REPOSITORY, CompanyRepository } from '../../../../companies/domain/repositories/company.repository.interface';

@CommandHandler(ArchiveApplicationCommand)
export class ArchiveApplicationHandler implements ICommandHandler<ArchiveApplicationCommand> {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly applicationRepository: ApplicationRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: CompanyRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ArchiveApplicationCommand): Promise<ApplicationReadModel> {
    const application = await loadApplicationOrThrow(this.applicationRepository, command.applicationId);
    // Fast, handler-level rejection (pre-existing) — kept as a first line of defense.
    await assertCanAccessApplication(this.companyRepository, application, command.actorRole, command.actorId);
    const actor = buildActor(command.actorRole, command.actorId);
    const correlationId = resolveCorrelationId(command.correlationId);
    const reason = command.reasonCode ? TransitionReason.create(command.reasonCode, command.reasonNote) : undefined;

    // M31.1 — resolved once here (real repository I/O the domain layer itself cannot perform) and
    // passed into `Application.archive()`, which is the AUTHORITATIVE enforcement point
    // (`ArchivalPolicy`) — never trust the handler-level check above alone; a caller that invokes
    // `application.archive()` directly, bypassing this handler entirely, still cannot bypass
    // ownership, because the aggregate enforces its own rule regardless of caller.
    const company = await this.companyRepository.findById(application.companyId);
    const companyOwnerId = company?.ownerId ?? null;

    try {
      application.archive(actor, correlationId, companyOwnerId, reason);
    } catch (error) {
      mapTransitionError(error);
    }

    await saveAndPublish(this.applicationRepository, this.eventBus, application);
    return ApplicationReadModelMapper.toReadModel(application);
  }
}
