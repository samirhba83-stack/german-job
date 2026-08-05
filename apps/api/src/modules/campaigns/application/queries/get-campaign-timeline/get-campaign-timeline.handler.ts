import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetCampaignTimelineQuery } from './get-campaign-timeline.query';
import { CAMPAIGN_REPOSITORY, CampaignRepository } from '../../../domain/repositories/campaign.repository.interface';
import { assertOwnerOrAdmin, loadCampaignOrThrow } from '../../campaign-command.helpers';
import { CampaignTimelineEntryReadModel } from '../../read-models/campaign.read-model';
import { CampaignReadModelMapper } from '../../read-models/campaign-read-model.mapper';

@QueryHandler(GetCampaignTimelineQuery)
export class GetCampaignTimelineHandler implements IQueryHandler<GetCampaignTimelineQuery> {
  constructor(@Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepository: CampaignRepository) {}

  async execute(query: GetCampaignTimelineQuery): Promise<CampaignTimelineEntryReadModel[]> {
    const campaign = await loadCampaignOrThrow(this.campaignRepository, query.campaignId);
    assertOwnerOrAdmin(campaign, query.requesterRole, query.requesterId);
    return campaign.timeline.entries().map((entry) => CampaignReadModelMapper.toTimelineEntryReadModel(entry));
  }
}
