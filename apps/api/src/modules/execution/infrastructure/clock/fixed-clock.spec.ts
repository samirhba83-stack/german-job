import { FixedClock } from './fixed-clock';

describe('FixedClock', () => {
  it('returns the initial time until advanced or set', () => {
    const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));

    expect(clock.now()).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('advances by the given number of milliseconds', () => {
    const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));

    clock.advance(5000);

    expect(clock.now()).toEqual(new Date('2026-01-01T00:00:05.000Z'));
  });

  it('sets an arbitrary point in time', () => {
    const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));

    clock.set(new Date('2030-06-15T12:00:00.000Z'));

    expect(clock.now()).toEqual(new Date('2030-06-15T12:00:00.000Z'));
  });
});
