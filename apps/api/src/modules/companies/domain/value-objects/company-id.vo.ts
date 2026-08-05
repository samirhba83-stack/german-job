import { ValueObject } from '../../../../shared/domain';
import { InvalidCompanyIdException } from '../exceptions/invalid-company-id.exception';

interface CompanyIdProps {
  value: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates the shape of a company identifier at command/query boundaries. */
export class CompanyId extends ValueObject<CompanyIdProps> {
  private constructor(props: CompanyIdProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  static create(value: string): CompanyId {
    if (!UUID_REGEX.test(value)) {
      throw new InvalidCompanyIdException(value);
    }

    return new CompanyId({ value });
  }
}
