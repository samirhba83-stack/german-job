import { ValueObject } from '../../../../shared/domain';
import { Probability } from './probability.vo';

interface SmartResumeSelectionProps {
  documentId: string | null;
  confidence: Probability | null;
  explanation: string | null;
  selectedBy: string | null;
  selectedAt: Date | null;
}

/**
 * Reserved architecture for selecting the most appropriate CV. The domain never chooses
 * randomly — it only accepts an assignment made by something outside itself.
 */
export class SmartResumeSelection extends ValueObject<SmartResumeSelectionProps> {
  private constructor(props: SmartResumeSelectionProps) {
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

  static unassigned(): SmartResumeSelection {
    return new SmartResumeSelection({
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
  }): SmartResumeSelection {
    return new SmartResumeSelection({
      documentId: props.documentId,
      confidence: props.confidence ?? null,
      explanation: props.explanation ?? null,
      selectedBy: props.selectedBy,
      selectedAt: props.selectedAt ?? new Date(),
    });
  }
}
