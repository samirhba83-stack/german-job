import { ValueObject } from '../../../../shared/domain';

interface WorkLocationProps {
  city: string;
  country: string;
  postalCode: string | null;
  street: string | null;
}

export class WorkLocation extends ValueObject<WorkLocationProps> {
  private constructor(props: WorkLocationProps) {
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

  static create(props: {
    city: string;
    country: string;
    postalCode?: string | null;
    street?: string | null;
  }): WorkLocation {
    const city = props.city.trim();
    const country = props.country.trim();

    if (!city) {
      throw new Error('Work location requires a city');
    }
    if (!country) {
      throw new Error('Work location requires a country');
    }

    return new WorkLocation({
      city,
      country,
      postalCode: props.postalCode?.trim() || null,
      street: props.street?.trim() || null,
    });
  }
}
