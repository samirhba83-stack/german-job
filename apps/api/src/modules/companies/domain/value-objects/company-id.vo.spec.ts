import { CompanyId } from './company-id.vo';
import { InvalidCompanyIdException } from '../exceptions/invalid-company-id.exception';

describe('CompanyId', () => {
  it('accepts a well-formed UUID', () => {
    const id = CompanyId.create('123e4567-e89b-12d3-a456-426614174000');

    expect(id.value).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('rejects a malformed id', () => {
    expect(() => CompanyId.create('not-a-uuid')).toThrow(InvalidCompanyIdException);
  });
});
