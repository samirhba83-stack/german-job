import { ValueObject } from '../../../../shared/domain';
import { Probability } from './probability.vo';

interface SmartMotivationLetterSelectionProps {
  documentId: string | null;
  confidence: Probability | null;
  explanation: string | null;
  selectedBy: string | null;
  selectedAt: Date | null;
}

/** Reserved architecture for selecting the best Motivation Letter per company. Never random. */
export class SmartMotivationLetterSelection extends ValueObject<SmartMotivationLetterSelectionProps> {
  private constructor(props: SmartMotivationLetterSelectionProps) {
    super(props);
  }

  get documentId(): string | null {
    return this.props.documentId;
  }

  get confidence(): Probability | null {
    return this.props.confidence;
  }

  get explanation(): string | null {
    return this.props.explanation;
  }

  get selectedBy(): string | null {
    return this.props.selectedBy;
  }

  get selectedAt(): Date | null {
    return this.props.selectedAt;
  }

  static unassigned(): SmartMotivationLetterSelection {
    return new SmartMotivationLetterSelection({
      documentId: null,
      confidence: null,
      explanation: null,
      selectedBy: null,
      selectedAt: null,
    });
  }

  static assign(props: {
    documentId: string;
    confidence?: Probability | null;
    explanation?: string | null;
    selectedBy: string;
    selectedAt?: Date;
  }): SmartMotivationLetterSelection {
    return new SmartMotivationLetterSelection({
      documentId: props.documentId,
      confidence: props.confidence ?? null,
      explanation: props.explanation ?? null,
      selectedBy: props.selectedBy,
      selectedAt: props.selectedAt ?? new Date(),
    });
  }
}
