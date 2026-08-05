import { ValueObject } from '../../../../shared/domain';
import { InvalidEmailException } from '../exceptions/invalid-email.exception';

interface EmailProps {
  value: string;
}

// Intentionally simple (not RFC 5322-complete) — mirrors the class-validator @IsEmail check
// at the HTTP boundary while still enforcing the invariant at the domain level.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  static create(value: string): Email {
    const normalized = value.trim().toLowerCase();

    if (!EMAIL_REGEX.test(normalized)) {
      throw new InvalidEmailException(value);
    }

    return new Email({ value: normalized });
  }
}
