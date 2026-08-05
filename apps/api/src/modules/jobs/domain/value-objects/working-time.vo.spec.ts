import { WorkingTime } from './working-time.vo';

describe('WorkingTime', () => {
  it('defaults hoursPerWeek to null and isFlexible to false', () => {
    const time = WorkingTime.create({});

    expect(time.hoursPerWeek).toBeNull();
    expect(time.isFlexible).toBe(false);
  });

  it('accepts a valid hours-per-week value', () => {
    const time = WorkingTime.create({ hoursPerWeek: 40, isFlexible: true });

    expect(time.hoursPerWeek).toBe(40);
    expect(time.isFlexible).toBe(true);
  });

  it('rejects an hours-per-week value out of range', () => {
    expect(() => WorkingTime.create({ hoursPerWeek: 0 })).toThrow(/between 1 and 80/);
    expect(() => WorkingTime.create({ hoursPerWeek: 81 })).toThrow(/between 1 and 80/);
  });
});
