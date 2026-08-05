import { CompanySearchSpecification } from './company-search.specification';

describe('CompanySearchSpecification', () => {
  it('applies defaults when no params are given', () => {
    const spec = CompanySearchSpecification.create({});

    expect(spec.page).toBe(1);
    expect(spec.limit).toBe(20);
    expect(spec.offset).toBe(0);
    expect(spec.keyword).toBeNull();
  });

  it('clamps limit to the maximum of 100', () => {
    const spec = CompanySearchSpecification.create({ limit: 500 });

    expect(spec.limit).toBe(100);
  });

  it('clamps page to a minimum of 1', () => {
    const spec = CompanySearchSpecification.create({ page: -5 });

    expect(spec.page).toBe(1);
  });

  it('computes offset from page and limit', () => {
    const spec = CompanySearchSpecification.create({ page: 3, limit: 10 });

    expect(spec.offset).toBe(20);
  });

  it('trims keyword and city', () => {
    const spec = CompanySearchSpecification.create({ keyword: '  acme  ', city: '  Berlin  ' });

    expect(spec.keyword).toBe('acme');
    expect(spec.city).toBe('Berlin');
  });
});
