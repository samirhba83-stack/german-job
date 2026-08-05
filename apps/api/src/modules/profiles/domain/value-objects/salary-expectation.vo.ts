import { ValueObject } from '../../../../shared/domain';
import { InvalidSalaryExpectationException } from '../exceptions/invalid-salary-expectation.exception';

interface SalaryExpectationProps {
  min: number;
  max: number;
  currency: string;
}

const CURRENCY_REGEX = /^[A-Z]{3}$/;

export class SalaryExpectation extends ValueObject<SalaryExpectationProps> {
  private constructor(props: SalaryExpectationProps) {
    super(props);
  }

  get min(): number {
    return this.props.min;
  }

  get max(): number {
    return this.props.max;
  }

  get currency(): string {
    return this.props.currency;
  }

  static create(min: number, max: number, currency: string): SalaryExpectation {
    if (min < 0 || max < 0) {
      throw new InvalidSalaryExpectationException('Salary values must be non-negative');
    }

    if (min > max) {
      throw new InvalidSalaryExpectationException('Minimum salary cannot exceed maximum salary');
    }

    const normalizedCurrency = currency.trim().toUpperCase();
    if (!CURRENCY_REGEX.test(normalizedCurrency)) {
      throw new InvalidSalaryExpectationException('Currency must be a 3-letter ISO 4217 code');
    }

    return new SalaryExpectation({ min, max, currency: normalizedCurrency });
  }
}
