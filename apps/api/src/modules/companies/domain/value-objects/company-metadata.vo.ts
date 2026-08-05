import { ValueObject } from '../../../../shared/domain';

interface CompanyMetadataProps {
  description: string | null;
  logoUrl: string | null;
  foundedYear: number | null;
  tags: string[];
}

const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 30;
const MAX_DESCRIPTION_LENGTH = 5000;

export class CompanyMetadata extends ValueObject<CompanyMetadataProps> {
  private constructor(props: CompanyMetadataProps) {
    super(props);
  }

  get description(): string | null {
    return this.props.description;
  }

  get logoUrl(): string | null {
    return this.props.logoUrl;
  }

  get foundedYear(): number | null {
    return this.props.foundedYear;
  }

  get tags(): ReadonlyArray<string> {
    return this.props.tags;
  }

  static create(props: {
    description?: string | null;
    logoUrl?: string | null;
    foundedYear?: number | null;
    tags?: string[];
  }): CompanyMetadata {
    const description = props.description?.trim() || null;
    if (description && description.length > MAX_DESCRIPTION_LENGTH) {
      throw new Error(`Company description exceeds ${MAX_DESCRIPTION_LENGTH} characters`);
    }

    if (props.foundedYear !== undefined && props.foundedYear !== null) {
      const currentYear = new Date().getFullYear();
      if (props.foundedYear < 1800 || props.foundedYear > currentYear) {
        throw new Error(`Founded year must be between 1800 and ${currentYear}`);
      }
    }

    const tags = Array.from(
      new Set((props.tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
    );
    if (tags.length > MAX_TAGS) {
      throw new Error(`A company cannot have more than ${MAX_TAGS} tags`);
    }
    const tooLong = tags.find((tag) => tag.length > MAX_TAG_LENGTH);
    if (tooLong) {
      throw new Error(`Tag exceeds ${MAX_TAG_LENGTH} characters: ${tooLong}`);
    }

    return new CompanyMetadata({
      description,
      logoUrl: props.logoUrl?.trim() || null,
      foundedYear: props.foundedYear ?? null,
      tags,
    });
  }

  static empty(): CompanyMetadata {
    return new CompanyMetadata({ description: null, logoUrl: null, foundedYear: null, tags: [] });
  }
}
