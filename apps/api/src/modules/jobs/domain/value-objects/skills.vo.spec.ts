import { Skills } from './skills.vo';

describe('Skills', () => {
  it('defaults to empty required/niceToHave lists', () => {
    const skills = Skills.empty();

    expect(skills.required).toEqual([]);
    expect(skills.niceToHave).toEqual([]);
    expect(skills.isEmpty()).toBe(true);
  });

  it('trims and deduplicates each list', () => {
    const skills = Skills.create({ required: [' TypeScript ', 'TypeScript'], niceToHave: ['GraphQL'] });

    expect(skills.required).toEqual(['TypeScript']);
    expect(skills.niceToHave).toEqual(['GraphQL']);
  });

  it('removes a skill from niceToHave if it is already required', () => {
    const skills = Skills.create({ required: ['TypeScript'], niceToHave: ['TypeScript', 'GraphQL'] });

    expect(skills.niceToHave).toEqual(['GraphQL']);
  });

  it('rejects more than 50 skills across both lists combined', () => {
    const required = Array.from({ length: 30 }, (_, i) => `req-${i}`);
    const niceToHave = Array.from({ length: 21 }, (_, i) => `nice-${i}`);

    expect(() => Skills.create({ required, niceToHave })).toThrow(/cannot have more than 50 skills/);
  });
});
