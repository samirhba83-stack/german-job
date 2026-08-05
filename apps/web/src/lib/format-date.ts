const LOCALE = 'en-GB';

/**
 * Milestone 24 production validation fix: every date/time in this product was previously rendered
 * via bare `toLocaleDateString()`/`toLocaleString()` with no locale argument — which silently
 * formats using whatever locale the browser/OS reports, not a deliberate product choice. Real
 * headless-browser rendering during this milestone's live validation caught the concrete failure
 * mode: with the runtime's ambient locale resolving to Arabic, dates rendered with reordered
 * digits and Arabic script mixed into an otherwise all-English UI ("27ص8:36:56 ,2026/7/" instead
 * of a real date). Every date/time displayed anywhere in this product now goes through these two
 * functions, pinned to a single explicit locale, so formatting is deterministic regardless of the
 * viewer's own browser/OS configuration.
 */
export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString(LOCALE);
}

export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString(LOCALE);
}
