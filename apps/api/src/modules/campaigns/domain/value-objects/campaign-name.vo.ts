import { ValueObject } from '../../../../shared/domain';
import { InvalidCampaignNameException } from '../exceptions/invalid-campaign-name.exception';

interface CampaignNameProps {
  value: string;
}

const MAX_LENGTH = 150;

export class CampaignName extends ValueObject<CampaignNameProps> {
  private constructor(props: CampaignNameProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  static create(value: string): CampaignName {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new InvalidCampaignNameException('Campaign name cannot be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidCampaignNameException(`Campaign name exceeds ${MAX_LENGTH} characters`);
    }
    return new CampaignName({ value: trimmed });
  }
}
