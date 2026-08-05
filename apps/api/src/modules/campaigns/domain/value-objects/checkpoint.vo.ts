import { ValueObject } from '../../../../shared/domain';

interface CheckpointProps {
  lastCompletedBatchId: string;
  cursorPosition: number;
  savedAt: Date;
}

/** The exact resume pointer — written on every completeBatch(), so resume never has to guess. */
export class Checkpoint extends ValueObject<CheckpointProps> {
  private constructor(props: CheckpointProps) {
    super(props);
  }

  get lastCompletedBatchId(): string {
    return this.props.lastCompletedBatchId;
  }

  get cursorPosition(): number {
    return this.props.cursorPosition;
  }

  get savedAt(): Date {
    return this.props.savedAt;
  }

  static create(props: { lastCompletedBatchId: string; cursorPosition: number; savedAt?: Date }): Checkpoint {
    return new Checkpoint({
      lastCompletedBatchId: props.lastCompletedBatchId,
      cursorPosition: props.cursorPosition,
      savedAt: props.savedAt ?? new Date(),
    });
  }
}
