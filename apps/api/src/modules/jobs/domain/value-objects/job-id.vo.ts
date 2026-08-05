import { ValueObject } from '../../../../shared/domain';
import { InvalidJobIdException } from '../exceptions/invalid-job-id.exception';

interface JobIdProps {
  value: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates the shape of a job identifier at command/query boundaries. */
export class JobId extends ValueObject<JobIdProps> {
  private constructor(props: JobIdProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  static create(value: string): JobId {
    if (!UUID_REGEX.test(value)) {
      throw new InvalidJobIdException(value);
    }

    return new JobId({ value });
  }
}
