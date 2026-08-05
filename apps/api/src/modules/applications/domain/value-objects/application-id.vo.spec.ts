import { ApplicationId } from './application-id.vo';
import { InvalidApplicationIdException } from '../exceptions/invalid-application-id.exception';

describe('ApplicationId', () => {
  it('accepts a well-formed UUID', () => {
    const id = ApplicationId.create('123e4567-e89b-12d3-a456-426614174000');
    expect(id.value).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('rejects a malformed id', () => {
    expect(() => ApplicationId.create('not-a-uuid')).toThrow(InvalidApplicationIdException);
  });
});
