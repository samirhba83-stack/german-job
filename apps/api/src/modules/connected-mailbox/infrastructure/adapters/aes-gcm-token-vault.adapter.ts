import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptedTokenBlob, TokenVaultNotConfiguredError, TokenVaultPort } from '../../domain/ports/token-vault.port';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32; // 256-bit
const IV_BYTES = 12; // 96-bit, the standard/recommended GCM nonce size

/**
 * M28.6 Phase 6 — real AES-256-GCM envelope encryption (Node's built-in, NIST-approved AEAD
 * cipher — never custom/invented cryptography). The key is sourced from `ConfigService`
 * (`MAILBOX_TOKEN_ENCRYPTION_KEY`, base64-encoded 32 bytes), matching this codebase's established
 * "secrets via ConfigService, never hardcoded" pattern (`jwt.config.ts`, Paddle/AWS credentials).
 *
 * Fails closed: `assertConfigured()` throws `TokenVaultNotConfiguredError` before any encrypt/
 * decrypt attempt if the key is missing or the wrong length — connecting a mailbox becomes
 * impossible until a real key is configured, never silently falling back to storing a token in
 * plaintext (Phase 6's own explicit requirement).
 *
 * Key versioning: `keyVersion` travels alongside every encrypted blob (both in the returned
 * `EncryptedTokenBlob` and, at the call site, persisted onto `ConnectedMailbox.tokenEncryptionVersion`).
 * Only one key version exists today (`MAILBOX_TOKEN_ENCRYPTION_KEY`/`_KEY_VERSION`, default `1`) —
 * the `keyForVersion()` lookup is structured so a future key rotation adds a second entry (e.g. a
 * `MAILBOX_TOKEN_ENCRYPTION_KEY_V2` env var) without changing any caller or any already-stored blob's
 * shape; old blobs keep decrypting with their own recorded version's key.
 */
@Injectable()
export class AesGcmTokenVaultAdapter implements TokenVaultPort {
  constructor(private readonly config: ConfigService) {}

  private get currentKeyVersion(): number {
    return this.config.get<number>('connectedMailbox.tokenEncryption.keyVersion', 1);
  }

  private keyForVersion(version: number): Buffer {
    if (version !== this.currentKeyVersion) {
      // A real, honest limitation named in the M28.6 report: only the current key version is
      // resolvable today. A future rotation adds real lookup logic here (e.g. an env-var-per-
      // version map) — deliberately not built speculatively ahead of an actual second key existing.
      throw new TokenVaultNotConfiguredError(`No encryption key is configured for token vault key version ${version}.`);
    }

    const base64Key = this.config.get<string>('connectedMailbox.tokenEncryption.key', '');
    if (!base64Key) {
      throw new TokenVaultNotConfiguredError('MAILBOX_TOKEN_ENCRYPTION_KEY is not configured — refusing to encrypt or decrypt a token.');
    }

    const key = Buffer.from(base64Key, 'base64');
    if (key.length !== KEY_BYTES) {
      throw new TokenVaultNotConfiguredError(`MAILBOX_TOKEN_ENCRYPTION_KEY must decode to exactly ${KEY_BYTES} bytes (got ${key.length}).`);
    }
    return key;
  }

  encrypt(plaintext: string): EncryptedTokenBlob {
    const keyVersion = this.currentKeyVersion;
    const key = this.keyForVersion(keyVersion);
    const iv = randomBytes(IV_BYTES);

    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`,
      keyVersion,
    };
  }

  decrypt(blob: EncryptedTokenBlob): string {
    const key = this.keyForVersion(blob.keyVersion);
    const parts = blob.ciphertext.split(':');
    if (parts.length !== 3) {
      throw new TokenVaultNotConfiguredError('Encrypted token blob is malformed (expected iv:authTag:ciphertext).');
    }
    const [ivB64, authTagB64, ciphertextB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  }
}
