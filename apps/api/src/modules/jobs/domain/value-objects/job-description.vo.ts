import { ValueObject } from '../../../../shared/domain';

interface JobDescriptionProps {
  value: string;
}

const MIN_LENGTH = 10;
const MAX_LENGTH = 20000;

export class JobDescription extends ValueObject<JobDescriptionProps> {
  private constructor(props: JobDescriptionProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  static create(value: string): JobDescription {
    const trimmed = value.trim();

    if (trimmed.length < MIN_LENGTH) {
      throw new Error(`Job description must be at least ${MIN_LENGTH} characters`);
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new Error(`Job description must not exceed ${MAX_LENGTH} characters`);
    }

    return new JobDescription({ value: trimmed });
  }
}
