import { ApplicationChannelType } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';

interface ApplicationChannelProps {
  type: ApplicationChannelType;
  campaignRef: string | null;
}

/**
 * Records how an application originated without the domain importing the Campaign Engine's
 * types — the Campaign Engine is identified only by an opaque reference string.
 */
export class ApplicationChannel extends ValueObject<ApplicationChannelProps> {
  private constructor(props: ApplicationChannelProps) {
    super(props);
  }

  get type(): ApplicationChannelType {
    return this.props.type;
  }

  get campaignRef(): string | null {
    return this.props.campaignRef;
  }

  static create(type: ApplicationChannelType, campaignRef?: string | null): ApplicationChannel {
    if (type === ApplicationChannelType.CAMPAIGN && !campaignRef?.trim()) {
      throw new Error('A campaign-originated application requires a campaign reference');
    }

    return new ApplicationChannel({ type, campaignRef: campaignRef?.trim() || null });
  }

  static direct(): ApplicationChannel {
    return new ApplicationChannel({ type: ApplicationChannelType.DIRECT, campaignRef: null });
  }
}
