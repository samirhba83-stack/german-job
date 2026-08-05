import { Weekday } from '@german-job-engine/shared-types';
import { IsWithinExecutionWindowSpecification } from './is-within-execution-window.specification';
import { ExecutionWindow } from '../value-objects/execution-window.vo';

describe('IsWithinExecutionWindowSpecification', () => {
  it('resolves weekday/hour in the window\'s own timezone, not raw UTC', () => {
    const berlinWindow = ExecutionWindow.create({
      allowedWeekdays: [Weekday.MONDAY],
      dailyStartHour: 8,
      dailyEndHour: 18,
      timezone: 'Europe/Berlin',
      respectHolidays: false,
    });

    // 2026-01-05 23:30 UTC is already Tuesday 00:30 in Berlin (UTC+1 in January) — must be
    // rejected precisely because the fix resolves in Berlin time, not UTC (where it would still
    // read as Monday and wrongly pass under the old, unwired implementation).
    const mondayLateUtc = new Date('2026-01-05T23:30:00.000Z');
    expect(IsWithinExecutionWindowSpecification.isSatisfiedBy(berlinWindow, mondayLateUtc)).toBe(false);

    // 2026-01-05 07:30 UTC is Monday 08:30 in Berlin — inside the window.
    const mondayMorningUtc = new Date('2026-01-05T07:30:00.000Z');
    expect(IsWithinExecutionWindowSpecification.isSatisfiedBy(berlinWindow, mondayMorningUtc)).toBe(true);
  });

  it('rejects a disallowed weekday', () => {
    const window = ExecutionWindow.create({
      allowedWeekdays: [Weekday.MONDAY],
      dailyStartHour: 0,
      dailyEndHour: 24,
      timezone: 'UTC',
      respectHolidays: false,
    });
    const tuesday = new Date('2026-01-06T12:00:00.000Z');
    expect(IsWithinExecutionWindowSpecification.isSatisfiedBy(window, tuesday)).toBe(false);
  });

  it('rejects an hour outside the daily range', () => {
    const window = ExecutionWindow.create({
      allowedWeekdays: [Weekday.MONDAY],
      dailyStartHour: 8,
      dailyEndHour: 9,
      timezone: 'UTC',
      respectHolidays: false,
    });
    const mondayNoon = new Date('2026-01-05T12:00:00.000Z');
    expect(IsWithinExecutionWindowSpecification.isSatisfiedBy(window, mondayNoon)).toBe(false);
  });

  it('respects the holiday flag when set, and ignores holidays when not', () => {
    const christmasDay = new Date('2026-12-25T10:00:00.000Z'); // a Friday in 2026
    const windowWithHolidays = ExecutionWindow.create({
      allowedWeekdays: [Weekday.FRIDAY],
      dailyStartHour: 0,
      dailyEndHour: 24,
      timezone: 'UTC',
      respectHolidays: true,
    });
    const windowIgnoringHolidays = ExecutionWindow.create({
      allowedWeekdays: [Weekday.FRIDAY],
      dailyStartHour: 0,
      dailyEndHour: 24,
      timezone: 'UTC',
      respectHolidays: false,
    });

    expect(IsWithinExecutionWindowSpecification.isSatisfiedBy(windowWithHolidays, christmasDay)).toBe(false);
    expect(IsWithinExecutionWindowSpecification.isSatisfiedBy(windowIgnoringHolidays, christmasDay)).toBe(true);
  });
});
