import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CampaignActorRole } from '@german-job-engine/shared-types';
import { SearchCampaignsQuery } from './search-campaigns.query';
import { CAMPAIGN_REPOSITORY, CampaignRepository } from '../../../domain/repositories/campaign.repository.interface';
import { CampaignSearchSpecification } from '../../../domain/specifications/campaign-search.specification';
import { PaginatedCampaignsReadModel } from '../../read-models/campaign.read-model';
import { CampaignReadModelMapper } from '../../read-models/campaign-read-model.mapper';

/** Ownership-scoped: a Candidate may only ever search their own campaigns — their ownerId is
 * enforced regardless of what was requested. Admin is unrestricted. */
@QueryHandler(SearchCampaignsQuery)
export class SearchCampaignsHandler implements IQueryHandler<SearchCampaignsQuery> {
  constructor(@Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepository: CampaignRepository) {}

  async execute(query: SearchCampaignsQuery): Promise<PaginatedCampaignsReadModel> {
    const ownerId = query.requesterRole === CampaignActorRole.CANDIDATE ? (query.requesterId ?? undefined) : query.ownerId;

    const specification = CampaignSearchSpecification.create({
      ownerId,
      status: query.status,
      strategyType: query.strategyType,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      page: query.page,
      limit: query.limit,
    });

    const { items, total } = await this.campaignRepository.search(specification);

    return {
      items: items.map((campaign) => CampaignReadModelMapper.toReadModel(campaign)),
      total,
      page: specification.page,
      limit: specification.limit,
    };
  }
}
