import { ApplicationChannelType } from '@german-job-engine/shared-types';
import { ApplicationChannel } from './application-channel.vo';

describe('ApplicationChannel', () => {
  it('creates a direct channel with no campaign reference', () => {
    const channel = ApplicationChannel.direct();
    expect(channel.type).toBe(ApplicationChannelType.DIRECT);
    expect(channel.campaignRef).toBeNull();
  });

  it('requires a campaign reference for CAMPAIGN-originated applications', () => {
    expect(() => ApplicationChannel.create(ApplicationChannelType.CAMPAIGN)).toThrow(
      /requires a campaign reference/,
    );
  });

  it('accepts a campaign reference for CAMPAIGN-originated applications', () => {
    const channel = ApplicationChannel.create(ApplicationChannelType.CAMPAIGN, 'camp-1');
    expect(channel.campaignRef).toBe('camp-1');
  });
});
