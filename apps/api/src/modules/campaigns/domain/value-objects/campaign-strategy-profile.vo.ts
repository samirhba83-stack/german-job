import { CampaignStrategyType } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';
import { Metadata } from './metadata.vo';

interface CampaignStrategyProfileProps {
  type: CampaignStrategyType;
  parameters: Metadata;
}

/**
 * A labeled, swappable configuration — not an algorithm. The domain stores `parameters` but
 * never reads it to decide anything; interpretation belongs to a future tuning engine.
 */
export class CampaignStrategyProfile extends ValueObject<CampaignStrategyProfileProps> {
  private constructor(props: CampaignStrategyProfileProps) {
    super(props);
  }

  get type(): CampaignStrategyType {
    return this.props.type;
  }

  get parameters(): Metadata {
    return this.props.parameters;
  }

  static create(type: CampaignStrategyType, parameters?: Metadata): CampaignStrategyProfile {
    return new CampaignStrategyProfile({ type, parameters: parameters ?? Metadata.empty() });
  }
}
