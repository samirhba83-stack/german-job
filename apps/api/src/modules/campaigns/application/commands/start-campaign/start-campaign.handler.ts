import { Inject } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { CampaignStatus } from '@german-job-engine/shared-types';
import { StartCampaignCommand } from './start-campaign.command';
import { CAMPAIGN_REPOSITORY, CampaignRepository } from '../../../domain/repositories/campaign.repository.interface';
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

@CommandHandler(StartCampaignCommand)
export class StartCampaignHandler implements ICommandHandler<StartCampaignCommand> {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepository: CampaignRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: StartCampaignCommand): Promise<CampaignReadModel> {
    const campaign = await loadCampaignOrThrow(this.campaignRepository, command.campaignId);
    assertOwnerOrAdmin(campaign, command.actorRole, command.actorId);

    if (campaign.status === CampaignStatus.RUNNING) {
      // Idempotent: starting an already-running campaign is a no-op success.
      return CampaignReadModelMapper.toReadModel(campaign);
    }

    const actor = buildActor(command.actorRole, command.actorId);
    const correlationId = resolveCorrelationId(command.correlationId);

    try {
      if (campaign.status === CampaignStatus.DRAFT) {
        campaign.markReady(actor, correlationId);
      }
      campaign.start(actor, correlationId);
    } catch (error) {
      mapDomainError(error);
    }

    await saveAndPublish(this.campaignRepository, this.eventBus, campaign);
    return CampaignReadModelMapper.toReadModel(campaign);
  }
}
