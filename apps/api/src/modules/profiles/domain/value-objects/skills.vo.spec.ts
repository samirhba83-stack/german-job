import { Skills } from './skills.vo';

describe('Skills', () => {
  it('trims and deduplicates skills', () => {
    const skills = Skills.create([' TypeScript ', 'TypeScript', 'Node.js', '']);

    expect(skills.items).toEqual(['TypeScript', 'Node.js']);
  });

  it('reports empty when no skills provided', () => {
    expect(Skills.empty().isEmpty()).toBe(true);
    expect(Skills.create(['Go']).isEmpty()).toBe(false);
  });

  it('rejects more than 50 skills', () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `skill-${i}`);

    expect(() => Skills.create(tooMany)).toThrow(/cannot have more than 50 skills/);
  });

  it('rejects a skill longer than 50 characters', () => {
    expect(() => Skills.create(['a'.repeat(51)])).toThrow(/exceeds 50 characters/);
  });
});
