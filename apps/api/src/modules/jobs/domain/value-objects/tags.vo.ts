import { ValueObject } from '../../../../shared/domain';

interface TagsProps {
  items: string[];
}

const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 30;

export class Tags extends ValueObject<TagsProps> {
  private constructor(props: TagsProps) {
    super(props);
  }

  get items(): ReadonlyArray<string> {
    return this.props.items;
  }

  isEmpty(): boolean {
    return this.props.items.length === 0;
  }

  static create(tags: string[]): Tags {
    const normalized = Array.from(
      new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
    );

    if (normalized.length > MAX_TAGS) {
      throw new Error(`A job cannot have more than ${MAX_TAGS} tags`);
    }

    const tooLong = normalized.find((tag) => tag.length > MAX_TAG_LENGTH);
    if (tooLong) {
      throw new Error(`Tag exceeds ${MAX_TAG_LENGTH} characters: ${tooLong}`);
    }

    return new Tags({ items: normalized });
  }

  static empty(): Tags {
    return new Tags({ items: [] });
  }
}
