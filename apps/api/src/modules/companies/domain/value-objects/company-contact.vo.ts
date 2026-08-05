import { ValueObject } from '../../../../shared/domain';
import { InvalidCompanyContactException } from '../exceptions/invalid-company-contact.exception';

interface CompanyContactProps {
  contactName: string | null;
  contactEmail: string;
  contactPhone: string | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+0-9()\-\s]{6,25}$/;

export class CompanyContact extends ValueObject<CompanyContactProps> {
  private constructor(props: CompanyContactProps) {
    super(props);
  }

  get contactName(): string | null {
    return this.props.contactName;
  }

  get contactEmail(): string {
    return this.props.contactEmail;
  }

  get contactPhone(): string | null {
    return this.props.contactPhone;
  }

  static create(props: {
    contactName?: string | null;
    contactEmail: string;
    contactPhone?: string | null;
  }): CompanyContact {
    const contactEmail = props.contactEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(contactEmail)) {
      throw new InvalidCompanyContactException(`Invalid contact email: ${props.contactEmail}`);
    }

    const contactPhone = props.contactPhone?.trim() || null;
    if (contactPhone && !PHONE_REGEX.test(contactPhone)) {
      throw new InvalidCompanyContactException(`Invalid contact phone: ${props.contactPhone}`);
    }

    return new CompanyContact({
      contactName: props.contactName?.trim() || null,
      contactEmail,
      contactPhone,
    });
  }
}
