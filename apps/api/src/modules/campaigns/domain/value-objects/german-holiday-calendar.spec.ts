import { GermanHolidayCalendar } from './german-holiday-calendar';

describe('GermanHolidayCalendar', () => {
  it('recognizes fixed-date federal holidays', () => {
    expect(GermanHolidayCalendar.isPublicHoliday(new Date(Date.UTC(2026, 0, 1)))).toBe(true); // New Year's Day
    expect(GermanHolidayCalendar.isPublicHoliday(new Date(Date.UTC(2026, 4, 1)))).toBe(true); // Labour Day
    expect(GermanHolidayCalendar.isPublicHoliday(new Date(Date.UTC(2026, 9, 3)))).toBe(true); // German Unity Day
    expect(GermanHolidayCalendar.isPublicHoliday(new Date(Date.UTC(2026, 11, 25)))).toBe(true); // Christmas Day
    expect(GermanHolidayCalendar.isPublicHoliday(new Date(Date.UTC(2026, 11, 26)))).toBe(true); // Boxing Day
  });

  it('computes movable Easter-relative holidays correctly for a known year', () => {
    // Easter Sunday 2026 is April 5 (independently verifiable).
    expect(GermanHolidayCalendar.isPublicHoliday(new Date(Date.UTC(2026, 3, 3)))).toBe(true); // Good Friday
    expect(GermanHolidayCalendar.isPublicHoliday(new Date(Date.UTC(2026, 3, 6)))).toBe(true); // Easter Monday
    expect(GermanHolidayCalendar.isPublicHoliday(new Date(Date.UTC(2026, 4, 14)))).toBe(true); // Ascension Day
    expect(GermanHolidayCalendar.isPublicHoliday(new Date(Date.UTC(2026, 4, 25)))).toBe(true); // Whit Monday
  });

  it('does not flag an ordinary working day', () => {
    expect(GermanHolidayCalendar.isPublicHoliday(new Date(Date.UTC(2026, 5, 15)))).toBe(false);
  });

  it('returns exactly 9 federal holidays per year', () => {
    expect(GermanHolidayCalendar.holidaysForYear(2026)).toHaveLength(9);
  });
});
