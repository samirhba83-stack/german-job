import { ValueObject } from '../../../../shared/domain';
import { InvalidProbabilityException } from '../exceptions/invalid-probability.exception';

interface ProbabilityProps {
  value: number;
}

/** Own copy of the Applications module's Probability VO — bounded 0..1, never computed here. */
export class Probability extends ValueObject<ProbabilityProps> {
  private constructor(props: ProbabilityProps) {
    super(props);
  }

  get value(): number {
    return this.props.value;
  }

  static create(value: number): Probability {
    if (value < 0 || value > 1) {
      throw new InvalidProbabilityException(value);
    }
    return new Probability({ value });
  }
}
