import { WorkLocation } from './work-location.vo';

describe('WorkLocation', () => {
  it('creates a valid location with optional fields defaulted to null', () => {
    const location = WorkLocation.create({ city: 'Berlin', country: 'Germany' });

    expect(location.city).toBe('Berlin');
    expect(location.postalCode).toBeNull();
    expect(location.street).toBeNull();
  });

  it('rejects a blank city', () => {
    expect(() => WorkLocation.create({ city: '  ', country: 'Germany' })).toThrow(/requires a city/);
  });

  it('rejects a blank country', () => {
    expect(() => WorkLocation.create({ city: 'Berlin', country: '  ' })).toThrow(/requires a country/);
  });
});
