export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

/** Port for persisting/validating issued refresh tokens (e.g. for revocation). */
export interface RefreshTokenRepository {
  store(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  isValid(userId: string, tokenHash: string): Promise<boolean>;
  revoke(userId: string): Promise<void>;
}
