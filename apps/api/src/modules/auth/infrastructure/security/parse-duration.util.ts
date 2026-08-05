const UNIT_TO_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Parses simple JWT-style durations (e.g. "15m", "7d") into milliseconds. */
export function parseDurationToMs(duration: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(duration.trim());

  if (!match) {
    throw new Error(`Unsupported duration format: ${duration}`);
  }

  const [, amount, unit] = match;
  return Number(amount) * UNIT_TO_MS[unit];
}
