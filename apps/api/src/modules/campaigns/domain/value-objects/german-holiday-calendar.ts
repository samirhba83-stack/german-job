/**
 * Federal (nationwide) German public holidays only — deterministic calendar math, not an AI
 * feature, closing the previously-decorative `respectHolidays` flag on ExecutionWindow. The 16
 * German states each add their own regional holidays (e.g. Epiphany, Reformation Day); those are
 * an explicitly out-of-scope, documented limitation here, not a hidden gap — a future
 * `state?: GermanFederalState` parameter can extend this without changing the call sites.
 */
export class GermanHolidayCalendar {
  static isPublicHoliday(date: Date): boolean {
    return GermanHolidayCalendar.holidaysForYear(date.getUTCFullYear()).some(
      (holiday) =>
        holiday.getUTCFullYear() === date.getUTCFullYear() &&
        holiday.getUTCMonth() === date.getUTCMonth() &&
        holiday.getUTCDate() === date.getUTCDate(),
    );
  }

  static holidaysForYear(year: number): Date[] {
    const easterSunday = GermanHolidayCalendar.computeEasterSunday(year);
    return [
      Date.UTC(year, 0, 1), // New Year's Day
      addUtcDays(easterSunday, -2), // Good Friday
      addUtcDays(easterSunday, 1), // Easter Monday
      Date.UTC(year, 4, 1), // Labour Day
      addUtcDays(easterSunday, 39), // Ascension Day
      addUtcDays(easterSunday, 50), // Whit Monday
      Date.UTC(year, 9, 3), // German Unity Day
      Date.UTC(year, 11, 25), // Christmas Day
      Date.UTC(year, 11, 26), // Boxing Day
    ].map((ms) => new Date(ms));
  }

  /** Anonymous Gregorian algorithm (Meeus/Jones/Butcher) — returns Easter Sunday at UTC midnight. */
  private static computeEasterSunday(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const monthDayEncoded = h + l - 7 * m + 114;
    const month = Math.floor(monthDayEncoded / 31); // 3 = March, 4 = April
    const day = (monthDayEncoded % 31) + 1;
    return new Date(Date.UTC(year, month - 1, day));
  }
}

function addUtcDays(date: Date, days: number): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days);
}
