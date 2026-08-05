import { ValueObject } from '../../../../shared/domain';

interface CorrelationIdProps {
  value: string;
}

export class CorrelationId extends ValueObject<CorrelationIdProps> {
  private constructor(props: CorrelationIdProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  static create(value: string): CorrelationId {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error('Correlation id cannot be empty');
    }
    return new CorrelationId({ value: trimmed });
  }
}
