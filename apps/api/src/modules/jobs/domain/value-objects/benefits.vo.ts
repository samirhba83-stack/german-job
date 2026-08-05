import { ValueObject } from '../../../../shared/domain';

interface BenefitsProps {
  items: string[];
}

const MAX_BENEFITS = 30;
const MAX_BENEFIT_LENGTH = 100;

export class Benefits extends ValueObject<BenefitsProps> {
  private constructor(props: BenefitsProps) {
    super(props);
  }

  get items(): ReadonlyArray<string> {
    return this.props.items;
  }

  isEmpty(): boolean {
    return this.props.items.length === 0;
  }

  static create(benefits: string[]): Benefits {
    const normalized = Array.from(
      new Set(benefits.map((benefit) => benefit.trim()).filter((benefit) => benefit.length > 0)),
    );

    if (normalized.length > MAX_BENEFITS) {
      throw new Error(`A job cannot have more than ${MAX_BENEFITS} benefits`);
    }

    const tooLong = normalized.find((benefit) => benefit.length > MAX_BENEFIT_LENGTH);
    if (tooLong) {
      throw new Error(`Benefit exceeds ${MAX_BENEFIT_LENGTH} characters: ${tooLong}`);
    }

    return new Benefits({ items: normalized });
  }

  static empty(): Benefits {
    return new Benefits({ items: [] });
  }
}
