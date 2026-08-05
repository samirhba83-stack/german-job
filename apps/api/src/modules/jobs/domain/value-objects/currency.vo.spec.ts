import { Currency as CurrencyCode } from '@german-job-engine/shared-types';
import { Currency } from './currency.vo';
import { InvalidCurrencyException } from '../exceptions/invalid-currency.exception';

describe('Currency', () => {
  it('creates a supported currency with its symbol', () => {
    const currency = Currency.create(CurrencyCode.EUR);

    expect(currency.code).toBe(CurrencyCode.EUR);
    expect(currency.symbol).toBe('€');
  });

  it('rejects an unsupported currency code', () => {
    expect(() => Currency.create('JPY')).toThrow(InvalidCurrencyException);
  });
});
