import { TransitiveDependentSkipPolicy } from './transitive-dependent-skip.policy';
import { ExecutionTask } from '../entities/execution-task.entity';

const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildTask(id: string, dependsOn: string[] = [], status: 'PENDING' | 'READY' = dependsOn.length === 0 ? 'READY' : 'PENDING'): ExecutionTask {
  return ExecutionTask.create(id, 'BATCH_EXECUTION', `Step ${id}`, `Explanation ${id}`, dependsOn, status, 'correlation-1', NOW);
}

describe('TransitiveDependentSkipPolicy', () => {
  const policy = new TransitiveDependentSkipPolicy();

  it('returns the direct dependent of the failed task', () => {
    const a = buildTask('a');
    const b = buildTask('b', ['a']);

    const skipped = policy.cascade(a, [a, b]);

    expect(skipped.map((t) => t.id)).toEqual(['b']);
  });

  it('cascades through a transitive chain', () => {
    const a = buildTask('a');
    const b = buildTask('b', ['a']);
    const c = buildTask('c', ['b']);

    const skipped = policy.cascade(a, [a, b, c]);

    expect(skipped.map((t) => t.id).sort()).toEqual(['b', 'c']);
  });

  it('does not touch an independent branch', () => {
    const a = buildTask('a');
    const b = buildTask('b', ['a']);
    const independent = buildTask('independent');

    const skipped = policy.cascade(a, [a, b, independent]);

    expect(skipped.map((t) => t.id)).toEqual(['b']);
  });

  it('handles a fan-out with multiple direct dependents', () => {
    const a = buildTask('a');
    const b = buildTask('b', ['a']);
    const c = buildTask('c', ['a']);

    const skipped = policy.cascade(a, [a, b, c]);

    expect(skipped.map((t) => t.id).sort()).toEqual(['b', 'c']);
  });

  it('returns an empty array when nothing depends on the failed task', () => {
    const a = buildTask('a');

    expect(policy.cascade(a, [a])).toEqual([]);
  });
});
