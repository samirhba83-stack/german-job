import { PreferredCities } from './preferred-cities.vo';

describe('PreferredCities', () => {
  it('trims and deduplicates cities', () => {
    const cities = PreferredCities.create([' Berlin ', 'Berlin', 'Munich']);

    expect(cities.items).toEqual(['Berlin', 'Munich']);
  });

  it('reports empty when no cities provided', () => {
    expect(PreferredCities.empty().isEmpty()).toBe(true);
    expect(PreferredCities.create(['Hamburg']).isEmpty()).toBe(false);
  });

  it('rejects more than 20 cities', () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `city-${i}`);

    expect(() => PreferredCities.create(tooMany)).toThrow(/cannot have more than 20 preferred cities/);
  });
});
