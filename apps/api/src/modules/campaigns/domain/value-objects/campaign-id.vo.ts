import { ValueObject } from '../../../../shared/domain';
import { InvalidCampaignIdException } from '../exceptions/invalid-campaign-id.exception';

interface CampaignIdProps {
  value: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CampaignId extends ValueObject<CampaignIdProps> {
  private constructor(props: CampaignIdProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  static create(value: string): CampaignId {
    if (!UUID_REGEX.test(value)) {
      throw new InvalidCampaignIdException(value);
    }
    return new CampaignId({ value });
  }
}
