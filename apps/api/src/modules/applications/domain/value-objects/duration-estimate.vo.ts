import { ValueObject } from '../../../../shared/domain';

export type DurationUnit = 'hours' | 'days' | 'weeks';

interface DurationEstimateProps {
  amount: number;
  unit: DurationUnit;
}

/** A value + unit ("3.2 days") — a bare number cannot defend what unit it is supposed to respect. */
export class DurationEstimate extends ValueObject<DurationEstimateProps> {
  private constructor(props: DurationEstimateProps) {
    super(props);
  }

  get amount(): number {
    return this.props.amount;
  }

  get unit(): DurationUnit {
    return this.props.unit;
  }

  static create(amount: number, unit: DurationUnit): DurationEstimate {
    if (amount < 0) {
      throw new Error('Duration estimate cannot be negative');
    }

    return new DurationEstimate({ amount, unit });
  }
}
