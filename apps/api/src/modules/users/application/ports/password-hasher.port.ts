export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

/** Port for password hashing, implemented by an infrastructure adapter (bcrypt). */
export interface PasswordHasher {
  hash(plainText: string): Promise<string>;
  compare(plainText: string, hash: string): Promise<boolean>;
}
