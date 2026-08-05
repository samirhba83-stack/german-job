import { Inject } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { CampaignStatus } from '@german-job-engine/shared-types';
import { PauseCampaignCommand } from './pause-campaign.command';
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

@CommandHandler(PauseCampaignCommand)
export class PauseCampaignHandler implements ICommandHandler<PauseCampaignCommand> {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepository: CampaignRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: PauseCampaignCommand): Promise<CampaignReadModel> {
    const campaign = await loadCampaignOrThrow(this.campaignRepository, command.campaignId);
    assertOwnerOrAdmin(campaign, command.actorRole, command.actorId);

    if (campaign.status === CampaignStatus.PAUSED) {
      return CampaignReadModelMapper.toReadModel(campaign);
    }

    const actor = buildActor(command.actorRole, command.actorId);
    const correlationId = resolveCorrelationId(command.correlationId);
    const reason = command.reasonCode ? CampaignReason.create(command.reasonCode, command.reasonNote) : undefined;

    try {
      campaign.pause(actor, correlationId, reason);
    } catch (error) {
      mapDomainError(error);
    }

    await saveAndPublish(this.campaignRepository, this.eventBus, campaign);
    return CampaignReadModelMapper.toReadModel(campaign);
  }
}
