import { ValueObject } from '../../../../shared/domain';

interface TrustScoreProps {
  score: number;
  computedAt: Date;
}

/**
 * Algorithmic trust/verification score for a company profile. Computed by a future
 * verification service — not settable by companies.
 */
export class TrustScore extends ValueObject<TrustScoreProps> {
  private constructor(props: TrustScoreProps) {
    super(props);
  }

  get score(): number {
    return this.props.score;
  }

  get computedAt(): Date {
    return this.props.computedAt;
  }

  static create(score: number, computedAt?: Date): TrustScore {
    if (score < 0 || score > 100) {
      throw new Error('Trust score must be between 0 and 100');
    }

    return new TrustScore({ score, computedAt: computedAt ?? new Date() });
  }
}
