import { JobTitle } from './job-title.vo';

describe('JobTitle', () => {
  it('trims the title', () => {
    expect(JobTitle.create('  Backend Engineer  ').value).toBe('Backend Engineer');
  });

  it('rejects a title shorter than 3 characters', () => {
    expect(() => JobTitle.create('AB')).toThrow(/at least 3 characters/);
  });

  it('rejects a title longer than 200 characters', () => {
    expect(() => JobTitle.create('A'.repeat(201))).toThrow(/must not exceed 200 characters/);
  });
});
