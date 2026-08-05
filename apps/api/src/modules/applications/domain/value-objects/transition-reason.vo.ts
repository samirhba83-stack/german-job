import { TransitionReasonCode } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';

interface TransitionReasonProps {
  code: TransitionReasonCode;
  note: string | null;
}

const MAX_NOTE_LENGTH = 1000;

/** Structured enough to query ("show me every auto-rejection"), free enough to explain the one-off case. */
export class TransitionReason extends ValueObject<TransitionReasonProps> {
  private constructor(props: TransitionReasonProps) {
    super(props);
  }

  get code(): TransitionReasonCode {
    return this.props.code;
  }

  get note(): string | null {
    return this.props.note;
  }

  static create(code: TransitionReasonCode, note?: string | null): TransitionReason {
    const trimmedNote = note?.trim() || null;
    if (trimmedNote && trimmedNote.length > MAX_NOTE_LENGTH) {
      throw new Error(`Transition reason note exceeds ${MAX_NOTE_LENGTH} characters`);
    }

    return new TransitionReason({ code, note: trimmedNote });
  }
}
