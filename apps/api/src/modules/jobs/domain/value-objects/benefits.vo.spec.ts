import { Benefits } from './benefits.vo';

describe('Benefits', () => {
  it('trims and deduplicates benefits', () => {
    const benefits = Benefits.create([' Remote work ', 'Remote work', 'Gym membership']);

    expect(benefits.items).toEqual(['Remote work', 'Gym membership']);
  });

  it('reports empty when no benefits provided', () => {
    expect(Benefits.empty().isEmpty()).toBe(true);
    expect(Benefits.create(['Bonus']).isEmpty()).toBe(false);
  });

  it('rejects more than 30 benefits', () => {
    const tooMany = Array.from({ length: 31 }, (_, i) => `benefit-${i}`);

    expect(() => Benefits.create(tooMany)).toThrow(/cannot have more than 30 benefits/);
  });
});
