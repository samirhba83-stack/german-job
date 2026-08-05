import { ValueObject } from '../../../../shared/domain';
import { InvalidProbabilityException } from '../exceptions/invalid-probability.exception';

interface CompanyFatigueScoreProps {
  value: number;
}

/** Reserved 0..1 score — mirrors Probability's validation, kept as its own concept. */
export class CompanyFatigueScore extends ValueObject<CompanyFatigueScoreProps> {
  private constructor(props: CompanyFatigueScoreProps) {
    super(props);
  }

  get value(): number {
    return this.props.value;
  }

  static create(value: number): CompanyFatigueScore {
    if (value < 0 || value > 1) {
      throw new InvalidProbabilityException(value);
    }
    return new CompanyFatigueScore({ value });
  }
}
