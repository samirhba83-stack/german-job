import { Metadata } from './metadata.vo';
import { InvalidMetadataException } from '../exceptions/invalid-metadata.exception';

describe('Metadata', () => {
  it('creates an empty metadata set', () => {
    expect(Metadata.empty().isEmpty()).toBe(true);
  });

  it('accepts up to 20 flat primitive entries', () => {
    const entries = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`key${i}`, i]));
    expect(Metadata.create(entries).isEmpty()).toBe(false);
  });

  it('rejects more than 20 keys', () => {
    const entries = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`key${i}`, i]));
    expect(() => Metadata.create(entries)).toThrow(InvalidMetadataException);
  });

  it('rejects a key longer than 60 characters', () => {
    expect(() => Metadata.create({ [`k${'x'.repeat(60)}`]: 'v' })).toThrow(InvalidMetadataException);
  });

  it('rejects a string value longer than 500 characters', () => {
    expect(() => Metadata.create({ note: 'x'.repeat(501) })).toThrow(InvalidMetadataException);
  });
});
