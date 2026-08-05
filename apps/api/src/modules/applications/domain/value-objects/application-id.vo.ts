import { ValueObject } from '../../../../shared/domain';
import { InvalidApplicationIdException } from '../exceptions/invalid-application-id.exception';

interface ApplicationIdProps {
  value: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates the shape of an application identifier at command/query boundaries. */
export class ApplicationId extends ValueObject<ApplicationIdProps> {
  private constructor(props: ApplicationIdProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  static create(value: string): ApplicationId {
    if (!UUID_REGEX.test(value)) {
      throw new InvalidApplicationIdException(value);
    }

    return new ApplicationId({ value });
  }
}
