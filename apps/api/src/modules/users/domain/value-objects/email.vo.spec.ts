import { Email } from './email.vo';
import { InvalidEmailException } from '../exceptions/invalid-email.exception';

describe('Email', () => {
  it('creates an Email for a valid address and normalizes it', () => {
    const email = Email.create('  Test@Example.com  ');

    expect(email.value).toBe('test@example.com');
  });

  it('throws InvalidEmailException for a malformed address', () => {
    expect(() => Email.create('not-an-email')).toThrow(InvalidEmailException);
  });

  it('treats two emails with the same normalized value as equal', () => {
    const a = Email.create('Same@Example.com');
    const b = Email.create('same@example.com');

    expect(a.equals(b)).toBe(true);
  });
});
