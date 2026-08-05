import { CampaignId } from './campaign-id.vo';
import { InvalidCampaignIdException } from '../exceptions/invalid-campaign-id.exception';

describe('CampaignId', () => {
  it('accepts a well-formed UUID', () => {
    expect(CampaignId.create('123e4567-e89b-12d3-a456-426614174000').value).toBe(
      '123e4567-e89b-12d3-a456-426614174000',
    );
  });

  it('rejects a malformed id', () => {
    expect(() => CampaignId.create('not-a-uuid')).toThrow(InvalidCampaignIdException);
  });
});
