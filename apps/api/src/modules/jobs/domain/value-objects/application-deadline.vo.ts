import { ValueObject } from '../../../../shared/domain';

interface ApplicationDeadlineProps {
  value: Date;
}

export class ApplicationDeadline extends ValueObject<ApplicationDeadlineProps> {
  private constructor(props: ApplicationDeadlineProps) {
    super(props);
  }

  get value(): Date {
    return this.props.value;
  }

  isExpired(referenceDate: Date = new Date()): boolean {
    return this.props.value.getTime() < referenceDate.getTime();
  }

  static create(value: Date): ApplicationDeadline {
    if (Number.isNaN(value.getTime())) {
      throw new Error('Application deadline must be a valid date');
    }

    return new ApplicationDeadline({ value });
  }
}
