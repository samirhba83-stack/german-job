import { SalaryPeriod } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';
import { Currency } from './currency.vo';
import { InvalidSalaryRangeException } from '../exceptions/invalid-salary-range.exception';

interface SalaryRangeProps {
  min: number;
  max: number;
  currency: Currency;
  period: SalaryPeriod;
}

export class SalaryRange extends ValueObject<SalaryRangeProps> {
  private constructor(props: SalaryRangeProps) {
    super(props);
  }

  get min(): number {
    return this.props.min;
  }

  get max(): number {
    return this.props.max;
  }

  get currency(): Currency {
    return this.props.currency;
  }

  get period(): SalaryPeriod {
    return this.props.period;
  }

  static create(props: { min: number; max: number; currency: string; period: SalaryPeriod }): SalaryRange {
    if (props.min < 0 || props.max < 0) {
      throw new InvalidSalaryRangeException('Salary values must be non-negative');
    }
    if (props.min > props.max) {
      throw new InvalidSalaryRangeException('Minimum salary cannot exceed maximum salary');
    }

    return new SalaryRange({
      min: props.min,
      max: props.max,
      currency: Currency.create(props.currency),
      period: props.period,
    });
  }
}
