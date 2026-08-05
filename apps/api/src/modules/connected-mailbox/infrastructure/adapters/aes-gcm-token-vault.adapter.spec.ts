import { randomBytes } from 'node:crypto';
import { AesGcmTokenVaultAdapter } from './aes-gcm-token-vault.adapter';
import { TokenVaultNotConfiguredError } from '../../domain/ports/token-vault.port';

const VALID_KEY = randomBytes(32).toString('base64');

function buildAdapter(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    'connectedMailbox.tokenEncryption.keyVersion': 1,
    'connectedMailbox.tokenEncryption.key': VALID_KEY,
    ...overrides,
  };
  const config = { get: jest.fn((key: string, defaultValue?: unknown) => values[key] ?? defaultValue) };
  return new AesGcmTokenVaultAdapter(config as never);
}

describe('AesGcmTokenVaultAdapter', () => {
  it('round-trips a plaintext token through encrypt then decrypt', () => {
    const vault = buildAdapter();
    const blob = vault.encrypt('a-real-oauth-refresh-token-value');
    expect(vault.decrypt(blob)).toBe('a-real-oauth-refresh-token-value');
  });

  it('produces a self-describing iv:authTag:ciphertext blob, never plaintext', () => {
    const vault = buildAdapter();
    const blob = vault.encrypt('super-secret-token');
    const parts = blob.ciphertext.split(':');
    expect(parts).toHaveLength(3);
    expect(blob.ciphertext).not.toContain('super-secret-token');
  });

  it('stamps the current key version onto every encrypted blob', () => {
    const vault = buildAdapter({ 'connectedMailbox.tokenEncryption.keyVersion': 1 });
    const blob = vault.encrypt('token');
    expect(blob.keyVersion).toBe(1);
  });

  it('uses a fresh random IV on every call — two encryptions of the same plaintext never match', () => {
    const vault = buildAdapter();
    const first = vault.encrypt('same-token-value');
    const second = vault.encrypt('same-token-value');
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it('fails closed with TokenVaultNotConfiguredError when the encryption key is missing', () => {
    const vault = buildAdapter({ 'connectedMailbox.tokenEncryption.key': '' });
    expect(() => vault.encrypt('token')).toThrow(TokenVaultNotConfiguredError);
  });

  it('fails closed with TokenVaultNotConfiguredError when the configured key is the wrong length', () => {
    const vault = buildAdapter({ 'connectedMailbox.tokenEncryption.key': Buffer.from('too-short').toString('base64') });
    expect(() => vault.encrypt('token')).toThrow(TokenVaultNotConfiguredError);
  });

  it('fails closed when decrypting a blob stamped with a key version that is not the current one', () => {
    const vault = buildAdapter();
    expect(() => vault.decrypt({ ciphertext: 'aa:bb:cc', keyVersion: 2 })).toThrow(TokenVaultNotConfiguredError);
  });

  it('rejects a malformed blob that is not iv:authTag:ciphertext', () => {
    const vault = buildAdapter();
    expect(() => vault.decrypt({ ciphertext: 'not-a-valid-blob', keyVersion: 1 })).toThrow(TokenVaultNotConfiguredError);
  });

  it('rejects a tampered ciphertext (AEAD authentication failure) rather than returning corrupted plaintext', () => {
    const vault = buildAdapter();
    const blob = vault.encrypt('a-real-token');
    const [iv, authTag, ciphertext] = blob.ciphertext.split(':');
    const tamperedCiphertext = Buffer.from(ciphertext, 'base64');
    tamperedCiphertext[0] = tamperedCiphertext[0] ^ 0xff;
    const tampered = { ciphertext: `${iv}:${authTag}:${tamperedCiphertext.toString('base64')}`, keyVersion: 1 };
    expect(() => vault.decrypt(tampered)).toThrow();
  });

  it('never encrypts/decrypts using a key that fails to decode to exactly 32 bytes, even if base64-valid', () => {
    const vault = buildAdapter({ 'connectedMailbox.tokenEncryption.key': Buffer.alloc(16, 7).toString('base64') });
    expect(() => vault.encrypt('token')).toThrow(TokenVaultNotConfiguredError);
  });
});
