import { CompanyLocation } from './company-location.vo';
import { InvalidCompanyLocationException } from '../exceptions/invalid-company-location.exception';

describe('CompanyLocation', () => {
  it('creates a valid location with optional fields defaulted to null', () => {
    const location = CompanyLocation.create({ city: 'Berlin', country: 'Germany' });

    expect(location.city).toBe('Berlin');
    expect(location.postalCode).toBeNull();
    expect(location.street).toBeNull();
    expect(location.federalState).toBeNull();
    expect(location.latitude).toBeNull();
    expect(location.longitude).toBeNull();
  });

  it('accepts real, verified federalState and coordinates when supplied (M18)', () => {
    const location = CompanyLocation.create({ city: 'Berlin', country: 'Germany', federalState: 'Berlin', latitude: 52.52, longitude: 13.405 });

    expect(location.federalState).toBe('Berlin');
    expect(location.latitude).toBe(52.52);
    expect(location.longitude).toBe(13.405);
  });

  it('rejects a blank city', () => {
    expect(() => CompanyLocation.create({ city: '  ', country: 'Germany' })).toThrow(
      InvalidCompanyLocationException,
    );
  });

  it('rejects a blank country', () => {
    expect(() => CompanyLocation.create({ city: 'Berlin', country: '  ' })).toThrow(
      InvalidCompanyLocationException,
    );
  });
});
