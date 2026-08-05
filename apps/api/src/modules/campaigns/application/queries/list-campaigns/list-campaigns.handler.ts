import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CampaignActorRole } from '@german-job-engine/shared-types';
import { ListCampaignsQuery } from './list-campaigns.query';
import { CAMPAIGN_REPOSITORY, CampaignRepository } from '../../../domain/repositories/campaign.repository.interface';
import { CampaignSearchSpecification } from '../../../domain/specifications/campaign-search.specification';
import { PaginatedCampaignsReadModel } from '../../read-models/campaign.read-model';
import { CampaignReadModelMapper } from '../../read-models/campaign-read-model.mapper';

/** List is Search with no filters beyond an optional ownerId — same convention as Jobs/Applications.
 * Ownership-scoped identically to SearchCampaignsHandler: a Candidate's ownerId is always forced
 * to their own id; Admin is unrestricted. */
@QueryHandler(ListCampaignsQuery)
export class ListCampaignsHandler implements IQueryHandler<ListCampaignsQuery> {
  constructor(@Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepository: CampaignRepository) {}

  async execute(query: ListCampaignsQuery): Promise<PaginatedCampaignsReadModel> {
    const ownerId = query.requesterRole === CampaignActorRole.CANDIDATE ? (query.requesterId ?? undefined) : query.ownerId;

    const specification = CampaignSearchSpecification.create({
      ownerId,
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
