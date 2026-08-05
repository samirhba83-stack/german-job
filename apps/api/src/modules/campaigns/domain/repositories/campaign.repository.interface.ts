import { Repository } from '../../../../shared/application';
import { Campaign } from '../entities/campaign.entity';
import { CampaignSearchSpecification } from '../specifications/campaign-search.specification';

export const CAMPAIGN_REPOSITORY = Symbol('CAMPAIGN_REPOSITORY');

export interface CampaignSearchResult {
  items: Campaign[];
  total: number;
}

export interface CampaignRepository extends Repository<Campaign, string> {
  findByOwnerId(ownerId: string): Promise<Campaign[]>;
  search(specification: CampaignSearchSpecification): Promise<CampaignSearchResult>;
}
