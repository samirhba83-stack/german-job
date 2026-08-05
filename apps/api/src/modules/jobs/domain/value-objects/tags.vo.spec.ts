import { Tags } from './tags.vo';

describe('Tags', () => {
  it('trims and deduplicates tags', () => {
    const tags = Tags.create([' urgent ', 'urgent', 'featured']);

    expect(tags.items).toEqual(['urgent', 'featured']);
  });

  it('reports empty when no tags provided', () => {
    expect(Tags.empty().isEmpty()).toBe(true);
  });

  it('rejects more than 20 tags', () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `tag-${i}`);

    expect(() => Tags.create(tooMany)).toThrow(/cannot have more than 20 tags/);
  });
});
