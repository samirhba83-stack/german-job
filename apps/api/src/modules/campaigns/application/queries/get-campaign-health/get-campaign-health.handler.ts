import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetCampaignHealthQuery } from './get-campaign-health.query';
import { CAMPAIGN_REPOSITORY, CampaignRepository } from '../../../domain/repositories/campaign.repository.interface';
import { assertOwnerOrAdmin, loadCampaignOrThrow } from '../../campaign-command.helpers';
import { CampaignHealthReadModel } from '../../read-models/campaign.read-model';
import { CampaignReadModelMapper } from '../../read-models/campaign-read-model.mapper';

@QueryHandler(GetCampaignHealthQuery)
export class GetCampaignHealthHandler implements IQueryHandler<GetCampaignHealthQuery> {
  constructor(@Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepository: CampaignRepository) {}

  async execute(query: GetCampaignHealthQuery): Promise<CampaignHealthReadModel | null> {
    const campaign = await loadCampaignOrThrow(this.campaignRepository, query.campaignId);
    assertOwnerOrAdmin(campaign, query.requesterRole, query.requesterId);
    return CampaignReadModelMapper.toHealthReadModel(campaign);
  }
}
