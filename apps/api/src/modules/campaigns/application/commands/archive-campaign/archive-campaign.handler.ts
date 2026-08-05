import { Inject } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { CampaignStatus } from '@german-job-engine/shared-types';
import { ArchiveCampaignCommand } from './archive-campaign.command';
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

@CommandHandler(ArchiveCampaignCommand)
export class ArchiveCampaignHandler implements ICommandHandler<ArchiveCampaignCommand> {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepository: CampaignRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ArchiveCampaignCommand): Promise<CampaignReadModel> {
    const campaign = await loadCampaignOrThrow(this.campaignRepository, command.campaignId);
    assertOwnerOrAdmin(campaign, command.actorRole, command.actorId);

    if (campaign.status === CampaignStatus.ARCHIVED) {
      return CampaignReadModelMapper.toReadModel(campaign);
    }

    const actor = buildActor(command.actorRole, command.actorId);
    const correlationId = resolveCorrelationId(command.correlationId);
    const reason = command.reasonCode ? CampaignReason.create(command.reasonCode, command.reasonNote) : undefined;

    try {
      campaign.archive(actor, correlationId, reason);
    } catch (error) {
      mapDomainError(error);
    }

    await saveAndPublish(this.campaignRepository, this.eventBus, campaign);
    return CampaignReadModelMapper.toReadModel(campaign);
  }
}
