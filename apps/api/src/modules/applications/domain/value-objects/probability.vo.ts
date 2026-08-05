import { ValueObject } from '../../../../shared/domain';
import { InvalidProbabilityException } from '../exceptions/invalid-probability.exception';

interface ProbabilityProps {
  value: number;
}

/**
 * The likelihood of a future outcome (reply, interview, offer, contract), as estimated by a
 * future Intelligence Engine. Never computed by this domain — see ApplicationIntelligence.
 */
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
