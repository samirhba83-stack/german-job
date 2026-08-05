import { CampaignReasonCode } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';
import { InvalidCooldownPeriodException } from '../exceptions/invalid-cooldown-period.exception';

interface CooldownPeriodProps {
  startedAt: Date;
  until: Date;
  reason: CampaignReasonCode;
}

/** Real, enforced (not reserved) — governs how long an auto-triggered pause lasts. */
export class CooldownPeriod extends ValueObject<CooldownPeriodProps> {
  private constructor(props: CooldownPeriodProps) {
    super(props);
  }

  get startedAt(): Date {
    return this.props.startedAt;
  }

  get until(): Date {
    return this.props.until;
  }

  get reason(): CampaignReasonCode {
    return this.props.reason;
  }

  isActive(referenceDate: Date = new Date()): boolean {
    return referenceDate < this.props.until;
  }

  static create(props: { startedAt: Date; until: Date; reason: CampaignReasonCode }): CooldownPeriod {
    if (props.until <= props.startedAt) {
      throw new InvalidCooldownPeriodException('until must be after startedAt');
    }
    return new CooldownPeriod({ ...props });
  }
}
