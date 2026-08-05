import { Inject } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { CampaignStatus } from '@german-job-engine/shared-types';
import { ResumeCampaignCommand } from './resume-campaign.command';
import { CAMPAIGN_REPOSITORY, CampaignRepository } from '../../../domain/repositories/campaign.repository.interface';
import { CampaignReason } from '../../../domain/value-objects/campaign-reason.vo';
import {
  assertOwnerOrAdmin,
  buildActor,
  loadCampaignOrThrow,
  mapDomainError,
  resolveCorrelationId,
  saveAndPublish,
} from '../../campaign-command.helpers';
import { CampaignReadModel } from '../../read-models/campaign.read-model';
import { CampaignReadModelMapper } from '../../read-models/campaign-read-model.mapper';

/** Resume is a single user-facing intent that spans two Domain transitions: Paused/CoolingDown/
 * Stopped -> Resuming -> Running. The handler orchestrates both aggregate calls in sequence;
 * every business rule (including checkpoint validation) still lives inside the aggregate. */
@CommandHandler(ResumeCampaignCommand)
export class ResumeCampaignHandler implements ICommandHandler<ResumeCampaignCommand> {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepository: CampaignRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ResumeCampaignCommand): Promise<CampaignReadModel> {
    const campaign = await loadCampaignOrThrow(this.campaignRepository, command.campaignId);
    assertOwnerOrAdmin(campaign, command.actorRole, command.actorId);

    if (campaign.status === CampaignStatus.RUNNING) {
      return CampaignReadModelMapper.toReadModel(campaign);
    }

    const actor = buildActor(command.actorRole, command.actorId);
    const correlationId = resolveCorrelationId(command.correlationId);
    const reason = command.reasonCode ? CampaignReason.create(command.reasonCode, command.reasonNote) : undefined;

    try {
      campaign.resume(actor, correlationId, reason);
      campaign.confirmResume(actor, correlationId);
    } catch (error) {
      mapDomainError(error);
    }

    await saveAndPublish(this.campaignRepository, this.eventBus, campaign);
    return CampaignReadModelMapper.toReadModel(campaign);
  }
}
