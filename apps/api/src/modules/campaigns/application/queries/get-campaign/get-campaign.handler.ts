import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetCampaignQuery } from './get-campaign.query';
import { CAMPAIGN_REPOSITORY, CampaignRepository } from '../../../domain/repositories/campaign.repository.interface';
import { assertOwnerOrAdmin, loadCampaignOrThrow } from '../../campaign-command.helpers';
import { CampaignReadModel } from '../../read-models/campaign.read-model';
import { CampaignReadModelMapper } from '../../read-models/campaign-read-model.mapper';

@QueryHandler(GetCampaignQuery)
export class GetCampaignHandler implements IQueryHandler<GetCampaignQuery> {
  constructor(@Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepository: CampaignRepository) {}

  async execute(query: GetCampaignQuery): Promise<CampaignReadModel> {
    const campaign = await loadCampaignOrThrow(this.campaignRepository, query.campaignId);
    assertOwnerOrAdmin(campaign, query.requesterRole, query.requesterId);
    return CampaignReadModelMapper.toReadModel(campaign);
  }
}
