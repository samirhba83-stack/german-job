import { JobId } from './job-id.vo';
import { InvalidJobIdException } from '../exceptions/invalid-job-id.exception';

describe('JobId', () => {
  it('accepts a well-formed UUID', () => {
    const id = JobId.create('123e4567-e89b-12d3-a456-426614174000');

    expect(id.value).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('rejects a malformed id', () => {
    expect(() => JobId.create('not-a-uuid')).toThrow(InvalidJobIdException);
  });
});
