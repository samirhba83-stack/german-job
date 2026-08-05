import { Inject } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { ReplayCampaignCommand } from './replay-campaign.command';
import { CAMPAIGN_REPOSITORY, CampaignRepository } from '../../../domain/repositories/campaign.repository.interface';
import {
  assertOwnerOrAdmin,
  buildActor,
  loadCampaignOrThrow,
  resolveCorrelationId,
  saveAndPublish,
} from '../../campaign-command.helpers';
import { CampaignReadModel } from '../../read-models/campaign.read-model';
import { CampaignReadModelMapper } from '../../read-models/campaign-read-model.mapper';

@CommandHandler(ReplayCampaignCommand)
export class ReplayCampaignHandler implements ICommandHandler<ReplayCampaignCommand> {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepository: CampaignRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ReplayCampaignCommand): Promise<CampaignReadModel> {
    const campaign = await loadCampaignOrThrow(this.campaignRepository, command.campaignId);
    assertOwnerOrAdmin(campaign, command.actorRole, command.actorId);

    const actor = buildActor(command.actorRole, command.actorId);
    const correlationId = resolveCorrelationId(command.correlationId);

    campaign.replay(command.scope, actor, correlationId, command.targetIds);

    await saveAndPublish(this.campaignRepository, this.eventBus, campaign);
    return CampaignReadModelMapper.toReadModel(campaign);
  }
}
