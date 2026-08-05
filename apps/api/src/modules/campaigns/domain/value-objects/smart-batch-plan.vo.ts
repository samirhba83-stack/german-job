import { ValueObject } from '../../../../shared/domain';
import { InvalidSmartBatchPlanException } from '../exceptions/invalid-smart-batch-plan.exception';

interface SmartBatchPlanProps {
  baseBatchSize: number;
  minBatchSize: number;
  maxBatchSize: number;
  adaptive: boolean;
  expansionIncrement: number | null;
}

/**
 * Batch sizing is deterministic and bounded, never algorithmic. `adaptive` and
 * `expansionIncrement` are stored as data only — nothing in the domain reads them to change
 * behavior; a future engine must call the reserved `adjustBatchSize()` hook on the aggregate.
 */
export class SmartBatchPlan extends ValueObject<SmartBatchPlanProps> {
  private constructor(props: SmartBatchPlanProps) {
    super(props);
  }

  get baseBatchSize(): number {
    return this.props.baseBatchSize;
  }

  get minBatchSize(): number {
    return this.props.minBatchSize;
  }

  get maxBatchSize(): number {
    return this.props.maxBatchSize;
  }

  get adaptive(): boolean {
    return this.props.adaptive;
  }

  get expansionIncrement(): number | null {
    return this.props.expansionIncrement;
  }

  static create(props: {
    baseBatchSize: number;
    minBatchSize: number;
    maxBatchSize: number;
    adaptive?: boolean;
    expansionIncrement?: number | null;
  }): SmartBatchPlan {
    if (!Number.isInteger(props.minBatchSize) || props.minBatchSize < 1) {
      throw new InvalidSmartBatchPlanException('minBatchSize must be a positive integer');
    }
    if (!Number.isInteger(props.maxBatchSize) || props.maxBatchSize < props.minBatchSize) {
      throw new InvalidSmartBatchPlanException('maxBatchSize must be >= minBatchSize');
    }
    if (
      !Number.isInteger(props.baseBatchSize) ||
      props.baseBatchSize < props.minBatchSize ||
      props.baseBatchSize > props.maxBatchSize
    ) {
      throw new InvalidSmartBatchPlanException('baseBatchSize must be within [minBatchSize, maxBatchSize]');
    }
    return new SmartBatchPlan({
      baseBatchSize: props.baseBatchSize,
      minBatchSize: props.minBatchSize,
      maxBatchSize: props.maxBatchSize,
      adaptive: props.adaptive ?? false,
      expansionIncrement: props.expansionIncrement ?? null,
    });
  }
}
