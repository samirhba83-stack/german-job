const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** Real byte counts only — every caller (plan limits, usage) reads a real `storageBytes` number
 * from the backend, never an estimate. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${exponent === 0 ? value : value.toFixed(value < 10 ? 1 : 0)} ${UNITS[exponent]}`;
}
