import { Inject, Injectable } from '@nestjs/common';
import { TokenVaultPort, TOKEN_VAULT_PORT, EncryptedTokenBlob, TokenVaultNotConfiguredError } from '../../domain/ports/token-vault.port';
import { ConnectedMailboxRecord } from '../../domain/models/connected-mailbox';

/**
 * M28.6 Phase 6 — the ONE application-layer service permitted to decrypt a mailbox's OAuth
 * tokens (Phase 6: "restrict token decryption to the mailbox integration service only"). Every
 * other service in this module (readiness, admin, controllers) only ever sees a `ConnectedMailboxRecord`
 * with opaque `encryptedRefreshToken`/`encryptedAccessToken` strings — never a decrypted value.
 */
@Injectable()
export class MailboxTokenVaultService {
  constructor(@Inject(TOKEN_VAULT_PORT) private readonly vault: TokenVaultPort) {}

  encryptRefreshToken(plaintext: string): EncryptedTokenBlob {
    return this.vault.encrypt(plaintext);
  }

  encryptAccessToken(plaintext: string): EncryptedTokenBlob {
    return this.vault.encrypt(plaintext);
  }

  decryptRefreshToken(mailbox: ConnectedMailboxRecord): string {
    if (!mailbox.encryptedRefreshToken || mailbox.tokenEncryptionVersion === null) {
      throw new TokenVaultNotConfiguredError(`Connected mailbox "${mailbox.id}" has no stored refresh token to decrypt.`);
    }
    return this.vault.decrypt({ ciphertext: mailbox.encryptedRefreshToken, keyVersion: mailbox.tokenEncryptionVersion });
  }

  decryptAccessToken(mailbox: ConnectedMailboxRecord): string | null {
    if (!mailbox.encryptedAccessToken || mailbox.tokenEncryptionVersion === null) {
      return null;
    }
    return this.vault.decrypt({ ciphertext: mailbox.encryptedAccessToken, keyVersion: mailbox.tokenEncryptionVersion });
  }
}
