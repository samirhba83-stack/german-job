import { Weekday } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';
import { InvalidExecutionWindowException } from '../exceptions/invalid-execution-window.exception';

interface ExecutionWindowProps {
  allowedWeekdays: Weekday[];
  dailyStartHour: number;
  dailyEndHour: number;
  timezone: string;
  respectHolidays: boolean;
}

export class ExecutionWindow extends ValueObject<ExecutionWindowProps> {
  private constructor(props: ExecutionWindowProps) {
    super(props);
  }

  get allowedWeekdays(): ReadonlyArray<Weekday> {
    return this.props.allowedWeekdays;
  }

  get dailyStartHour(): number {
    return this.props.dailyStartHour;
  }

  get dailyEndHour(): number {
    return this.props.dailyEndHour;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  get respectHolidays(): boolean {
    return this.props.respectHolidays;
  }

  static create(props: {
    allowedWeekdays: Weekday[];
    dailyStartHour: number;
    dailyEndHour: number;
    timezone: string;
    respectHolidays?: boolean;
  }): ExecutionWindow {
    if (props.allowedWeekdays.length === 0) {
      throw new InvalidExecutionWindowException('At least one allowed weekday is required');
    }
    if (
      !Number.isInteger(props.dailyStartHour) ||
      props.dailyStartHour < 0 ||
      props.dailyStartHour > 23
    ) {
      throw new InvalidExecutionWindowException('dailyStartHour must be an integer between 0 and 23');
    }
    if (!Number.isInteger(props.dailyEndHour) || props.dailyEndHour < 1 || props.dailyEndHour > 24) {
      throw new InvalidExecutionWindowException('dailyEndHour must be an integer between 1 and 24');
    }
    if (props.dailyEndHour <= props.dailyStartHour) {
      throw new InvalidExecutionWindowException('dailyEndHour must be after dailyStartHour');
    }
    if (!props.timezone.trim()) {
      throw new InvalidExecutionWindowException('timezone is required');
    }
    return new ExecutionWindow({
      allowedWeekdays: [...props.allowedWeekdays],
      dailyStartHour: props.dailyStartHour,
      dailyEndHour: props.dailyEndHour,
      timezone: props.timezone.trim(),
      respectHolidays: props.respectHolidays ?? true,
    });
  }
}
