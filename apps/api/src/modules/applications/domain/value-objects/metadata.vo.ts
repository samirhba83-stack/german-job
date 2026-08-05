import { ValueObject } from '../../../../shared/domain';
import { InvalidMetadataException } from '../exceptions/invalid-metadata.exception';

interface MetadataProps {
  entries: Record<string, string | number | boolean>;
}

const MAX_KEYS = 20;
const MAX_KEY_LENGTH = 60;
const MAX_VALUE_LENGTH = 500;

/**
 * A bounded escape hatch for context that doesn't have a first-class field yet — size-limited
 * so it can't become an undisciplined dumping ground. Only flat, primitive values are accepted;
 * nesting would defeat the point of keeping the aggregate's shape predictable.
 */
export class Metadata extends ValueObject<MetadataProps> {
  private constructor(props: MetadataProps) {
    super(props);
  }

  get entries(): Readonly<Record<string, string | number | boolean>> {
    return this.props.entries;
  }

  isEmpty(): boolean {
    return Object.keys(this.props.entries).length === 0;
  }

  static create(entries: Record<string, string | number | boolean>): Metadata {
    const keys = Object.keys(entries);

    if (keys.length > MAX_KEYS) {
      throw new InvalidMetadataException(`Metadata cannot have more than ${MAX_KEYS} keys`);
    }

    for (const key of keys) {
      if (key.length > MAX_KEY_LENGTH) {
        throw new InvalidMetadataException(`Metadata key exceeds ${MAX_KEY_LENGTH} characters: ${key}`);
      }
      const value = entries[key];
      if (typeof value === 'string' && value.length > MAX_VALUE_LENGTH) {
        throw new InvalidMetadataException(`Metadata value for "${key}" exceeds ${MAX_VALUE_LENGTH} characters`);
      }
    }

    return new Metadata({ entries: { ...entries } });
  }

  static empty(): Metadata {
    return new Metadata({ entries: {} });
  }
}
