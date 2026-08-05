import { ValueObject } from '../../../../shared/domain';
import { InvalidCompanyWebsiteException } from '../exceptions/invalid-company-website.exception';

interface CompanyWebsiteProps {
  value: string;
}

export class CompanyWebsite extends ValueObject<CompanyWebsiteProps> {
  private constructor(props: CompanyWebsiteProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  static create(value: string): CompanyWebsite {
    const trimmed = value.trim();

    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new InvalidCompanyWebsiteException(value);
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new InvalidCompanyWebsiteException(value);
    }

    return new CompanyWebsite({ value: trimmed });
  }
}
