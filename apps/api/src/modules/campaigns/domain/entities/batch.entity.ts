import { BatchStatus } from '@german-job-engine/shared-types';
import { Entity } from '../../../../shared/domain';

export interface BatchProps {
  plannedSize: number;
  targetIds: string[];
  status: BatchStatus;
  startedAt: Date | null;
  completedAt: Date | null;
}

/** One progressive execution slice — the Campaign never sends everything at once. */
export class Batch extends Entity<string> {
  private props: BatchProps;

  private constructor(id: string, props: BatchProps) {
    super(id);
    this.props = props;
  }

  get plannedSize(): number {
    return this.props.plannedSize;
  }

  get targetIds(): ReadonlyArray<string> {
    return this.props.targetIds;
  }

  get status(): BatchStatus {
    return this.props.status;
  }

  get startedAt(): Date | null {
    return this.props.startedAt;
  }

  get completedAt(): Date | null {
    return this.props.completedAt;
  }

  static create(id: string, targetIds: string[], now: Date = new Date()): Batch {
    return new Batch(id, {
      plannedSize: targetIds.length,
      targetIds: [...targetIds],
      status: BatchStatus.RUNNING,
      startedAt: now,
      completedAt: null,
    });
  }

  static reconstitute(id: string, props: BatchProps): Batch {
    return new Batch(id, props);
  }

  complete(now: Date = new Date()): void {
    this.props.status = BatchStatus.COMPLETED;
    this.props.completedAt = now;
  }

  completePartially(now: Date = new Date()): void {
    this.props.status = BatchStatus.PARTIALLY_COMPLETED;
    this.props.completedAt = now;
  }

  fail(now: Date = new Date()): void {
    this.props.status = BatchStatus.FAILED;
    this.props.completedAt = now;
  }
}
