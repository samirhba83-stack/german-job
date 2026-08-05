import { CompanyWebsite } from './company-website.vo';
import { InvalidCompanyWebsiteException } from '../exceptions/invalid-company-website.exception';

describe('CompanyWebsite', () => {
  it('accepts a well-formed https URL', () => {
    const website = CompanyWebsite.create('https://acme.de');

    expect(website.value).toBe('https://acme.de');
  });

  it('rejects a malformed URL', () => {
    expect(() => CompanyWebsite.create('not a url')).toThrow(InvalidCompanyWebsiteException);
  });

  it('rejects a non-http(s) protocol', () => {
    expect(() => CompanyWebsite.create('ftp://acme.de')).toThrow(InvalidCompanyWebsiteException);
  });
});
