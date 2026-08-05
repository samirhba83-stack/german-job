import { CompanyContact } from './company-contact.vo';
import { InvalidCompanyContactException } from '../exceptions/invalid-company-contact.exception';

describe('CompanyContact', () => {
  it('normalizes the email to lowercase and trims optional fields', () => {
    const contact = CompanyContact.create({
      contactName: '  Jane  ',
      contactEmail: 'Jobs@Acme.DE',
      contactPhone: ' +49 30 1234567 ',
    });

    expect(contact.contactEmail).toBe('jobs@acme.de');
    expect(contact.contactName).toBe('Jane');
    expect(contact.contactPhone).toBe('+49 30 1234567');
  });

  it('rejects an invalid email', () => {
    expect(() => CompanyContact.create({ contactEmail: 'not-an-email' })).toThrow(
      InvalidCompanyContactException,
    );
  });

  it('rejects an invalid phone number', () => {
    expect(() =>
      CompanyContact.create({ contactEmail: 'jobs@acme.de', contactPhone: 'abc' }),
    ).toThrow(InvalidCompanyContactException);
  });
});
