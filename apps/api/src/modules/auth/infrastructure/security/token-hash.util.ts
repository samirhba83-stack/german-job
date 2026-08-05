import { createHash } from 'crypto';

/**
 * Refresh tokens are already high-entropy signed JWTs, so a fast deterministic hash
 * (rather than a slow salted one like bcrypt) is sufficient for at-rest storage and lookup.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
