const LOCALE = 'en-GB';

/** Same pinned-locale discipline as format-date.ts — every price in the product (pricing cards,
 * ledger history, checkout) renders through this, never a bare `toLocaleString()` that would
 * drift with the viewer's own browser/OS locale. */
function formatEuroCents(cents: number): string {
  const amount = cents / 100;
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Plan-card price — "Free" for the zero-cost tier rather than a literal "€0", matching how the
 * plan catalogue's own marketing copy talks about it. */
export function formatPlanPrice(priceCents: number): string {
  return priceCents === 0 ? 'Free' : `${formatEuroCents(priceCents)}/mo`;
}

/** Ledger amount — `null` for non-monetary events (e.g. a plan change with no charge of its own). */
export function formatLedgerAmount(amountCents: number | null): string {
  return amountCents === null ? '—' : formatEuroCents(amountCents);
}
