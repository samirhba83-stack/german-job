import { JobDescription } from './job-description.vo';

describe('JobDescription', () => {
  it('trims the description', () => {
    expect(JobDescription.create('  We are hiring!  ').value).toBe('We are hiring!');
  });

  it('rejects a description shorter than 10 characters', () => {
    expect(() => JobDescription.create('too short')).toThrow(/at least 10 characters/);
  });

  it('rejects a description longer than 20000 characters', () => {
    expect(() => JobDescription.create('A'.repeat(20001))).toThrow(/must not exceed 20000 characters/);
  });
});
