import { ValueObject } from '../../../../shared/domain';

interface HiringQualityProps {
  score: number;
  computedAt: Date;
}

/**
 * Algorithmic assessment of how well a company runs its hiring process (response time,
 * completion rate, etc.). Computed by a future scoring service — not settable by companies.
 */
export class HiringQuality extends ValueObject<HiringQualityProps> {
  private constructor(props: HiringQualityProps) {
    super(props);
  }

  get score(): number {
    return this.props.score;
  }

  get computedAt(): Date {
    return this.props.computedAt;
  }

  static create(score: number, computedAt?: Date): HiringQuality {
    if (score < 0 || score > 100) {
      throw new Error('Hiring quality score must be between 0 and 100');
    }

    return new HiringQuality({ score, computedAt: computedAt ?? new Date() });
  }
}
