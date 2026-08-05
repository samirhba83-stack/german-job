import { ApplicationDeadline } from './application-deadline.vo';

describe('ApplicationDeadline', () => {
  it('wraps a valid date', () => {
    const date = new Date('2026-12-31');
    const deadline = ApplicationDeadline.create(date);

    expect(deadline.value).toBe(date);
  });

  it('rejects an invalid date', () => {
    expect(() => ApplicationDeadline.create(new Date('not-a-date'))).toThrow(/valid date/);
  });

  it('reports whether the deadline has expired relative to a reference date', () => {
    const deadline = ApplicationDeadline.create(new Date('2026-01-01'));

    expect(deadline.isExpired(new Date('2026-02-01'))).toBe(true);
    expect(deadline.isExpired(new Date('2025-12-01'))).toBe(false);
  });
});
