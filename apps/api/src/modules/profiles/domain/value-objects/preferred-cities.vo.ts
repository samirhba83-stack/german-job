import { ValueObject } from '../../../../shared/domain';

interface PreferredCitiesProps {
  items: string[];
}

const MAX_CITIES = 20;
const MAX_CITY_LENGTH = 100;

export class PreferredCities extends ValueObject<PreferredCitiesProps> {
  private constructor(props: PreferredCitiesProps) {
    super(props);
  }

  get items(): ReadonlyArray<string> {
    return this.props.items;
  }

  isEmpty(): boolean {
    return this.props.items.length === 0;
  }

  static create(cities: string[]): PreferredCities {
    const normalized = Array.from(
      new Set(cities.map((city) => city.trim()).filter((city) => city.length > 0)),
    );

    if (normalized.length > MAX_CITIES) {
      throw new Error(`A profile cannot have more than ${MAX_CITIES} preferred cities`);
    }

    const tooLong = normalized.find((city) => city.length > MAX_CITY_LENGTH);
    if (tooLong) {
      throw new Error(`City name exceeds ${MAX_CITY_LENGTH} characters: ${tooLong}`);
    }

    return new PreferredCities({ items: normalized });
  }

  static empty(): PreferredCities {
    return new PreferredCities({ items: [] });
  }
}
