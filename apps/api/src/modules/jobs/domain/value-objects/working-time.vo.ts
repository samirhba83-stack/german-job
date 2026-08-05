import { ValueObject } from '../../../../shared/domain';

interface WorkingTimeProps {
  hoursPerWeek: number | null;
  isFlexible: boolean;
}

const MAX_HOURS_PER_WEEK = 80;

export class WorkingTime extends ValueObject<WorkingTimeProps> {
  private constructor(props: WorkingTimeProps) {
    super(props);
  }

  get hoursPerWeek(): number | null {
    return this.props.hoursPerWeek;
  }

  get isFlexible(): boolean {
    return this.props.isFlexible;
  }

  static create(props: { hoursPerWeek?: number | null; isFlexible?: boolean }): WorkingTime {
    const hoursPerWeek = props.hoursPerWeek ?? null;

    if (hoursPerWeek !== null && (hoursPerWeek <= 0 || hoursPerWeek > MAX_HOURS_PER_WEEK)) {
      throw new Error(`Working hours per week must be between 1 and ${MAX_HOURS_PER_WEEK}`);
    }

    return new WorkingTime({ hoursPerWeek, isFlexible: props.isFlexible ?? false });
  }
}
