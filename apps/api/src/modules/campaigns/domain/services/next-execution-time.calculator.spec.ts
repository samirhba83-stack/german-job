import { Weekday } from '@german-job-engine/shared-types';
import { NextExecutionTimeCalculator } from './next-execution-time.calculator';
import { ExecutionWindow } from '../value-objects/execution-window.vo';

function mondayOnly(): ExecutionWindow {
  return ExecutionWindow.create({
    allowedWeekdays: [Weekday.MONDAY],
    dailyStartHour: 8,
    dailyEndHour: 18,
    timezone: 'UTC',
    respectHolidays: false,
  });
}

function alwaysOpen(): ExecutionWindow {
  return ExecutionWindow.create({
    allowedWeekdays: [
      Weekday.MONDAY,
      Weekday.TUESDAY,
      Weekday.WEDNESDAY,
      Weekday.THURSDAY,
      Weekday.FRIDAY,
      Weekday.SATURDAY,
      Weekday.SUNDAY,
    ],
    dailyStartHour: 0,
    dailyEndHour: 24,
    timezone: 'UTC',
    respectHolidays: false,
  });
}

describe('NextExecutionTimeCalculator', () => {
  it('returns the same instant when it already satisfies the window and there is no cooldown', () => {
    const from = new Date('2026-01-05T08:00:00.000Z'); // a Monday, exactly at window open

    const result = new NextExecutionTimeCalculator().calculate(mondayOnly(), null, from);

    expect(result).toEqual(from);
  });

  it('finds the next allowed weekday when the current day is not allowed', () => {
    const from = new Date('2026-01-06T10:00:00.000Z'); // Tuesday

    const result = new NextExecutionTimeCalculator().calculate(mondayOnly(), null, from);

    expect(result).toEqual(new Date('2026-01-12T08:00:00.000Z')); // following Monday
  });

  it('honors a cooldown that extends past the window would otherwise allow', () => {
    const from = new Date('2026-01-05T00:00:00.000Z');
    const cooldownUntil = new Date('2026-01-05T10:30:00.000Z');

    const result = new NextExecutionTimeCalculator().calculate(alwaysOpen(), cooldownUntil, from);

    expect(result).toEqual(new Date('2026-01-05T11:00:00.000Z')); // rounded up to the next hour
  });

  it('returns null when no eligible instant exists within the search horizon', () => {
    const from = new Date('2026-01-05T00:00:00.000Z');
    const cooldownUntil = new Date('2026-01-25T00:00:00.000Z'); // 20 days out, beyond the 14-day horizon

    const result = new NextExecutionTimeCalculator().calculate(alwaysOpen(), cooldownUntil, from);

    expect(result).toBeNull();
  });
});
