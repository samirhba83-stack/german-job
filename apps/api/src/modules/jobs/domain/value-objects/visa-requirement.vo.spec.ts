import { VisaSponsorship } from '@german-job-engine/shared-types';
import { VisaRequirement } from './visa-requirement.vo';

describe('VisaRequirement', () => {
  it('creates a valid requirement', () => {
    const requirement = VisaRequirement.create(VisaSponsorship.OFFERED, true);

    expect(requirement.sponsorshipAvailable).toBe(VisaSponsorship.OFFERED);
    expect(requirement.requiresEuWorkAuthorization).toBe(true);
  });
});
