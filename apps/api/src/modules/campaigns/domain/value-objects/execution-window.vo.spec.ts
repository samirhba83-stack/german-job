import { Weekday } from '@german-job-engine/shared-types';
import { ExecutionWindow } from './execution-window.vo';
import { InvalidExecutionWindowException } from '../exceptions/invalid-execution-window.exception';

describe('ExecutionWindow', () => {
  it('accepts a valid window', () => {
    const window = ExecutionWindow.create({
      allowedWeekdays: [Weekday.MONDAY],
      dailyStartHour: 8,
      dailyEndHour: 18,
      timezone: 'Europe/Berlin',
    });
    expect(window.respectHolidays).toBe(true);
  });

  it('rejects an empty weekday list', () => {
    expect(() =>
      ExecutionWindow.create({ allowedWeekdays: [], dailyStartHour: 8, dailyEndHour: 18, timezone: 'Europe/Berlin' }),
    ).toThrow(InvalidExecutionWindowException);
  });

  it('rejects an end hour at or before the start hour', () => {
    expect(() =>
      ExecutionWindow.create({
        allowedWeekdays: [Weekday.MONDAY],
        dailyStartHour: 18,
        dailyEndHour: 8,
        timezone: 'Europe/Berlin',
      }),
    ).toThrow(InvalidExecutionWindowException);
  });
});
