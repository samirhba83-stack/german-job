import { ValueObject } from '../../../../shared/domain';

interface JobTitleProps {
  value: string;
}

const MIN_LENGTH = 3;
const MAX_LENGTH = 200;

export class JobTitle extends ValueObject<JobTitleProps> {
  private constructor(props: JobTitleProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  static create(value: string): JobTitle {
    const trimmed = value.trim();

    if (trimmed.length < MIN_LENGTH) {
      throw new Error(`Job title must be at least ${MIN_LENGTH} characters`);
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new Error(`Job title must not exceed ${MAX_LENGTH} characters`);
    }

    return new JobTitle({ value: trimmed });
  }
}
