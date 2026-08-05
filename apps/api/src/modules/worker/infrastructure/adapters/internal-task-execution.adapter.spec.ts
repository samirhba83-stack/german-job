import { InternalTaskExecutionAdapter } from './internal-task-execution.adapter';
import { ExecutionTask } from '../../../execution-orchestrator/domain/entities/execution-task.entity';

const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildTask(): ExecutionTask {
  return ExecutionTask.create('task-1', 'BATCH_EXECUTION', 'Execute batch 1', 'Explanation.', [], 'READY', 'correlation-1', NOW);
}

describe('InternalTaskExecutionAdapter', () => {
  const adapter = new InternalTaskExecutionAdapter();

  it('always simulates a successful outcome', async () => {
    const outcome = await adapter.execute(buildTask());

    expect(outcome.success).toBe(true);
    expect(outcome.failureReason).toBeNull();
    expect(outcome.reason).toContain('task-1');
    expect(outcome.reason).toContain('BATCH_EXECUTION');
    expect(outcome.reason).toContain('internal simulation adapter');
  });

  it('is deterministic across repeated calls for the same task', async () => {
    const task = buildTask();

    const first = await adapter.execute(task);
    const second = await adapter.execute(task);

    expect(first).toEqual(second);
  });
});
