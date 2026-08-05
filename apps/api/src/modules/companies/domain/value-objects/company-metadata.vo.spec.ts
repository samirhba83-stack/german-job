import { CompanyMetadata } from './company-metadata.vo';

describe('CompanyMetadata', () => {
  it('defaults to empty', () => {
    const metadata = CompanyMetadata.empty();

    expect(metadata.description).toBeNull();
    expect(metadata.tags).toEqual([]);
  });

  it('trims and deduplicates tags', () => {
    const metadata = CompanyMetadata.create({ tags: [' remote ', 'remote', 'hiring'] });

    expect(metadata.tags).toEqual(['remote', 'hiring']);
  });

  it('rejects more than 20 tags', () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `tag-${i}`);

    expect(() => CompanyMetadata.create({ tags: tooMany })).toThrow(/cannot have more than 20 tags/);
  });

  it('rejects a founded year outside the valid range', () => {
    expect(() => CompanyMetadata.create({ foundedYear: 1700 })).toThrow(/Founded year/);
    expect(() => CompanyMetadata.create({ foundedYear: new Date().getFullYear() + 1 })).toThrow(
      /Founded year/,
    );
  });
});
