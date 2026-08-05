import { Currency, SalaryPeriod } from '@german-job-engine/shared-types';
import { SalaryRange } from './salary-range.vo';
import { InvalidSalaryRangeException } from '../exceptions/invalid-salary-range.exception';

describe('SalaryRange', () => {
  it('creates a valid salary range', () => {
    const range = SalaryRange.create({ min: 45000, max: 60000, currency: Currency.EUR, period: SalaryPeriod.ANNUAL });

    expect(range.min).toBe(45000);
    expect(range.max).toBe(60000);
    expect(range.currency.code).toBe(Currency.EUR);
    expect(range.period).toBe(SalaryPeriod.ANNUAL);
  });

  it('rejects a minimum greater than the maximum', () => {
    expect(() =>
      SalaryRange.create({ min: 60000, max: 45000, currency: Currency.EUR, period: SalaryPeriod.ANNUAL }),
    ).toThrow(InvalidSalaryRangeException);
  });

  it('rejects negative values', () => {
    expect(() =>
      SalaryRange.create({ min: -1, max: 1000, currency: Currency.EUR, period: SalaryPeriod.ANNUAL }),
    ).toThrow(InvalidSalaryRangeException);
  });
});
