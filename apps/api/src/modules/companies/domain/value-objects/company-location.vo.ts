import { ValueObject } from '../../../../shared/domain';
import { InvalidCompanyLocationException } from '../exceptions/invalid-company-location.exception';

interface CompanyLocationProps {
  city: string;
  country: string;
  postalCode: string | null;
  street: string | null;
  /** M18: real, verified geographic data only — never inferred from city/postalCode. */
  federalState: string | null;
  latitude: number | null;
  longitude: number | null;
}

export class CompanyLocation extends ValueObject<CompanyLocationProps> {
  private constructor(props: CompanyLocationProps) {
    super(props);
  }

  get city(): string {
    return this.props.city;
  }

  get country(): string {
    return this.props.country;
  }

  get postalCode(): string | null {
    return this.props.postalCode;
  }

  get street(): string | null {
    return this.props.street;
  }

  get federalState(): string | null {
    return this.props.federalState;
  }

  get latitude(): number | null {
    return this.props.latitude;
  }

  get longitude(): number | null {
    return this.props.longitude;
  }

  static create(props: {
    city: string;
    country: string;
    postalCode?: string | null;
    street?: string | null;
    federalState?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }): CompanyLocation {
    const city = props.city.trim();
    const country = props.country.trim();

    if (!city) {
      throw new InvalidCompanyLocationException('Company location requires a city');
    }
    if (!country) {
      throw new InvalidCompanyLocationException('Company location requires a country');
    }

    return new CompanyLocation({
      city,
      country,
      postalCode: props.postalCode?.trim() || null,
      street: props.street?.trim() || null,
      federalState: props.federalState?.trim() || null,
      latitude: props.latitude ?? null,
      longitude: props.longitude ?? null,
    });
  }
}
