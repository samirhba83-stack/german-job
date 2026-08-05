import { VisaSponsorship } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';

interface VisaRequirementProps {
  sponsorshipAvailable: VisaSponsorship;
  requiresEuWorkAuthorization: boolean;
}

export class VisaRequirement extends ValueObject<VisaRequirementProps> {
  private constructor(props: VisaRequirementProps) {
    super(props);
  }

  get sponsorshipAvailable(): VisaSponsorship {
    return this.props.sponsorshipAvailable;
  }

  get requiresEuWorkAuthorization(): boolean {
    return this.props.requiresEuWorkAuthorization;
  }

  static create(sponsorshipAvailable: VisaSponsorship, requiresEuWorkAuthorization: boolean): VisaRequirement {
    return new VisaRequirement({ sponsorshipAvailable, requiresEuWorkAuthorization });
  }
}
