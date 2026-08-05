import { Weekday } from '@german-job-engine/shared-types';
import { ExecutionWindow } from '../value-objects/execution-window.vo';
import { GermanHolidayCalendar } from '../value-objects/german-holiday-calendar';

const WEEKDAY_BY_SHORT_NAME: Record<string, Weekday> = {
  Mon: Weekday.MONDAY,
  Tue: Weekday.TUESDAY,
  Wed: Weekday.WEDNESDAY,
  Thu: Weekday.THURSDAY,
  Fri: Weekday.FRIDAY,
  Sat: Weekday.SATURDAY,
  Sun: Weekday.SUNDAY,
};

interface ZonedInstant {
  weekday: Weekday;
  hour: number;
  localDate: Date;
}

/**
 * Checks a given instant against the ExecutionWindow's allowed weekdays/hours, resolved in the
 * window's own configured timezone via Intl.DateTimeFormat (built into Node — no new
 * dependency). A prior version compared raw UTC hours directly, silently ignoring `timezone`
 * entirely; that bug was dormant only because nothing called this specification yet.
 */
export class IsWithinExecutionWindowSpecification {
  static isSatisfiedBy(window: ExecutionWindow, instant: Date): boolean {
    const zoned = resolveZonedInstant(instant, window.timezone);

    if (!window.allowedWeekdays.includes(zoned.weekday)) {
      return false;
    }
    if (zoned.hour < window.dailyStartHour || zoned.hour >= window.dailyEndHour) {
      return false;
    }
    if (window.respectHolidays && GermanHolidayCalendar.isPublicHoliday(zoned.localDate)) {
      return false;
    }
    return true;
  }
}

function resolveZonedInstant(instant: Date, timeZone: string): ZonedInstant {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(instant);
  const lookup = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? '';

  const weekdayName = lookup('weekday');
  const weekday = WEEKDAY_BY_SHORT_NAME[weekdayName];
  if (!weekday) {
    throw new Error(`Unable to resolve weekday "${weekdayName}" for timezone "${timeZone}"`);
  }

  return {
    weekday,
    hour: Number(lookup('hour')),
    localDate: new Date(Date.UTC(Number(lookup('year')), Number(lookup('month')) - 1, Number(lookup('day')))),
  };
}
