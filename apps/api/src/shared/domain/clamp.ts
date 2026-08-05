/** Clamps a value into the closed interval [0, 1] — the shared scale for every score across the domain. */
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
