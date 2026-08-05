import { Currency as CurrencyCode } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';
import { InvalidCurrencyException } from '../exceptions/invalid-currency.exception';

interface CurrencyProps {
  code: CurrencyCode;
}

const SYMBOLS: Record<CurrencyCode, string> = {
  [CurrencyCode.EUR]: '€',
  [CurrencyCode.USD]: '$',
  [CurrencyCode.GBP]: '£',
  [CurrencyCode.CHF]: 'CHF',
};

/** Wraps a supported ISO 4217 currency code, giving it real behavior beyond a bare string. */
export class Currency extends ValueObject<CurrencyProps> {
  private constructor(props: CurrencyProps) {
    super(props);
  }

  get code(): CurrencyCode {
    return this.props.code;
  }

  get symbol(): string {
    return SYMBOLS[this.props.code];
  }

  static create(code: string): Currency {
    if (!Object.values(CurrencyCode).includes(code as CurrencyCode)) {
      throw new InvalidCurrencyException(code);
    }

    return new Currency({ code: code as CurrencyCode });
  }
}
