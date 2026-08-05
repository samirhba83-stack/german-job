import { SalaryExpectation } from './salary-expectation.vo';
import { InvalidSalaryExpectationException } from '../exceptions/invalid-salary-expectation.exception';

describe('SalaryExpectation', () => {
  it('creates a valid salary expectation and normalizes the currency to uppercase', () => {
    const salary = SalaryExpectation.create(40000, 60000, 'eur');

    expect(salary.min).toBe(40000);
    expect(salary.max).toBe(60000);
    expect(salary.currency).toBe('EUR');
  });

  it('rejects a minimum greater than the maximum', () => {
    expect(() => SalaryExpectation.create(60000, 40000, 'EUR')).toThrow(InvalidSalaryExpectationException);
  });

  it('rejects negative values', () => {
    expect(() => SalaryExpectation.create(-1, 1000, 'EUR')).toThrow(InvalidSalaryExpectationException);
  });

  it('rejects a currency that is not a 3-letter code', () => {
    expect(() => SalaryExpectation.create(0, 1000, 'EURO')).toThrow(InvalidSalaryExpectationException);
  });
});
