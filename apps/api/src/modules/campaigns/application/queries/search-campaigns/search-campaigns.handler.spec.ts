import { CampaignActorRole } from '@german-job-engine/shared-types';
import { SearchCampaignsHandler } from './search-campaigns.handler';
import { SearchCampaignsQuery } from './search-campaigns.query';
import { CampaignRepository } from '../../../domain/repositories/campaign.repository.interface';

describe('SearchCampaignsHandler', () => {
  let campaignRepository: jest.Mocked<CampaignRepository>;
  let handler: SearchCampaignsHandler;

  beforeEach(() => {
    campaignRepository = {
      findById: jest.fn(),
      findByOwnerId: jest.fn(),
      search: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    handler = new SearchCampaignsHandler(campaignRepository);
  });

  it('builds a normalized specification and returns a paginated read model for Admin', async () => {
    campaignRepository.search.mockResolvedValue({ items: [], total: 0 });

    const result = await handler.execute(
      new SearchCampaignsQuery(CampaignActorRole.ADMIN, 'admin-1', 'candidate-1', undefined, undefined, undefined, undefined, 0, 500),
    );

    expect(campaignRepository.search).toHaveBeenCalledTimes(1);
    const specification = campaignRepository.search.mock.calls[0][0];
    expect(specification.ownerId).toBe('candidate-1');
    expect(specification.page).toBe(1);
    expect(specification.limit).toBe(100);
    expect(result).toEqual({ items: [], total: 0, page: 1, limit: 100 });
  });

  it('forces ownerId to the requester for a Candidate actor, ignoring any ownerId passed in', async () => {
    campaignRepository.search.mockResolvedValue({ items: [], total: 0 });

    await handler.execute(
      new SearchCampaignsQuery(CampaignActorRole.CANDIDATE, 'candidate-1', 'someone-else', undefined, undefined, undefined, undefined),
    );

    const specification = campaignRepository.search.mock.calls[0][0];
    expect(specification.ownerId).toBe('candidate-1');
  });
});
