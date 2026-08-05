export const TOKEN_VAULT_PORT = Symbol('TOKEN_VAULT_PORT');

export class TokenVaultNotConfiguredError extends Error {}

export interface EncryptedTokenBlob {
  /** Self-describing: `base64(iv):base64(authTag):base64(ciphertext)` — no separate IV/tag
   * columns needed. */
  readonly ciphertext: string;
  readonly keyVersion: number;
}

/**
 * M28.6 Phase 6 — the one place an OAuth token is ever encrypted or decrypted. Access and refresh
 * tokens are highly sensitive credentials: never stored in plaintext, never logged, never
 * returned through any API response. Implementations MUST fail closed — throw
 * `TokenVaultNotConfiguredError` rather than ever falling back to storing plaintext — when the
 * encryption key is not configured (Phase 6: "fail closed when encryption configuration is
 * missing").
 */
export interface TokenVaultPort {
  encrypt(plaintext: string): EncryptedTokenBlob;
  decrypt(blob: EncryptedTokenBlob): string;
}
