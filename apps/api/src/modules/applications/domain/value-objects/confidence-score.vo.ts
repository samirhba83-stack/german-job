import { ValueObject } from '../../../../shared/domain';
import { InvalidConfidenceScoreException } from '../exceptions/invalid-confidence-score.exception';

interface ConfidenceScoreProps {
  value: number;
}

/**
 * How sure the platform is that an observed signal is accurate — passive tracking signals
 * (opened, viewed) are inherently unreliable, so confidence is part of the fact, not an afterthought.
 */
export class ConfidenceScore extends ValueObject<ConfidenceScoreProps> {
  private constructor(props: ConfidenceScoreProps) {
    super(props);
  }

  get value(): number {
    return this.props.value;
  }

  static create(value: number): ConfidenceScore {
    if (value < 0 || value > 1) {
      throw new InvalidConfidenceScoreException(value);
    }

    return new ConfidenceScore({ value });
  }
}
