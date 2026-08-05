import { BcryptPasswordHasher } from './bcrypt-password-hasher';

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher();

  it('hashes a password to a different string', async () => {
    const hash = await hasher.hash('correct-horse-battery-staple');

    expect(hash).not.toBe('correct-horse-battery-staple');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('verifies a matching plaintext/hash pair', async () => {
    const hash = await hasher.hash('correct-horse-battery-staple');

    await expect(hasher.compare('correct-horse-battery-staple', hash)).resolves.toBe(true);
  });

  it('rejects a non-matching plaintext/hash pair', async () => {
    const hash = await hasher.hash('correct-horse-battery-staple');

    await expect(hasher.compare('wrong-password', hash)).resolves.toBe(false);
  });
});
