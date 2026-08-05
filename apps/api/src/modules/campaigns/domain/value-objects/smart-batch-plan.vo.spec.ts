import { SmartBatchPlan } from './smart-batch-plan.vo';
import { InvalidSmartBatchPlanException } from '../exceptions/invalid-smart-batch-plan.exception';

describe('SmartBatchPlan', () => {
  it('accepts a base size within [min, max]', () => {
    const plan = SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 10 });
    expect(plan.baseBatchSize).toBe(5);
    expect(plan.adaptive).toBe(false);
  });

  it('rejects a base size outside [min, max]', () => {
    expect(() => SmartBatchPlan.create({ baseBatchSize: 20, minBatchSize: 1, maxBatchSize: 10 })).toThrow(
      InvalidSmartBatchPlanException,
    );
  });

  it('rejects maxBatchSize below minBatchSize', () => {
    expect(() => SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 10, maxBatchSize: 5 })).toThrow(
      InvalidSmartBatchPlanException,
    );
  });
});
