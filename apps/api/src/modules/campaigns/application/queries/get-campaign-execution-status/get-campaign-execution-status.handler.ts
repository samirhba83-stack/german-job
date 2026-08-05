import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetCampaignExecutionStatusQuery } from './get-campaign-execution-status.query';
import { CAMPAIGN_REPOSITORY, CampaignRepository } from '../../../domain/repositories/campaign.repository.interface';
import { assertOwnerOrAdmin, loadCampaignOrThrow } from '../../campaign-command.helpers';
import { CampaignExecutionStatusReadModel } from '../../read-models/campaign.read-model';
import { CampaignReadModelMapper } from '../../read-models/campaign-read-model.mapper';

@QueryHandler(GetCampaignExecutionStatusQuery)
export class GetCampaignExecutionStatusHandler implements IQueryHandler<GetCampaignExecutionStatusQuery> {
  constructor(@Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepository: CampaignRepository) {}

  async execute(query: GetCampaignExecutionStatusQuery): Promise<CampaignExecutionStatusReadModel> {
    const campaign = await loadCampaignOrThrow(this.campaignRepository, query.campaignId);
    assertOwnerOrAdmin(campaign, query.requesterRole, query.requesterId);
    return CampaignReadModelMapper.toExecutionStatusReadModel(campaign);
  }
}
