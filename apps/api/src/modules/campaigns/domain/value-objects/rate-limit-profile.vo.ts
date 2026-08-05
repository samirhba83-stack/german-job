import { ValueObject } from '../../../../shared/domain';
import { InvalidRateLimitProfileException } from '../exceptions/invalid-rate-limit-profile.exception';

interface RateLimitProfileProps {
  maxPerDay: number;
  maxPerHour: number;
  maxPerCompanyPerWindow: number;
}

/** Real, enforced structural caps — arithmetic, not prediction. Backs RateLimitPolicy. */
export class RateLimitProfile extends ValueObject<RateLimitProfileProps> {
  private constructor(props: RateLimitProfileProps) {
    super(props);
  }

  get maxPerDay(): number {
    return this.props.maxPerDay;
  }

  get maxPerHour(): number {
    return this.props.maxPerHour;
  }

  get maxPerCompanyPerWindow(): number {
    return this.props.maxPerCompanyPerWindow;
  }

  static create(props: { maxPerDay: number; maxPerHour: number; maxPerCompanyPerWindow: number }): RateLimitProfile {
    if (!Number.isInteger(props.maxPerDay) || props.maxPerDay < 1) {
      throw new InvalidRateLimitProfileException('maxPerDay must be a positive integer');
    }
    if (!Number.isInteger(props.maxPerHour) || props.maxPerHour < 1) {
      throw new InvalidRateLimitProfileException('maxPerHour must be a positive integer');
    }
    if (!Number.isInteger(props.maxPerCompanyPerWindow) || props.maxPerCompanyPerWindow < 1) {
      throw new InvalidRateLimitProfileException('maxPerCompanyPerWindow must be a positive integer');
    }
    return new RateLimitProfile({ ...props });
  }

  static default(): RateLimitProfile {
    return new RateLimitProfile({ maxPerDay: 50, maxPerHour: 10, maxPerCompanyPerWindow: 1 });
  }
}
