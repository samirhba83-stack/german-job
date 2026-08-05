import { Injectable } from '@nestjs/common';
import { ExecutionTask } from '../entities/execution-task.entity';
import { FailureCascadePolicy } from '../ports/failure-cascade-policy.port';

/**
 * Default FAILURE_CASCADE_POLICY binding: every non-terminal task that transitively depends on
 * the failed task (directly or through a chain of dependencies) is skipped, since none of them
 * can ever satisfy their dependency chain now. A dependent can never be RUNNING at this point —
 * the pipeline only starts a task once every dependency has COMPLETED, so a failed dependency
 * guarantees every descendant is still PENDING — but the terminal check stays for defense in
 * depth regardless.
 */
@Injectable()
export class TransitiveDependentSkipPolicy implements FailureCascadePolicy {
  cascade(failedTask: ExecutionTask, allTasks: ReadonlyArray<ExecutionTask>): ExecutionTask[] {
    const dependentsOf = new Map<string, ExecutionTask[]>();
    for (const task of allTasks) {
      for (const dependencyId of task.dependsOn) {
        const dependents = dependentsOf.get(dependencyId) ?? [];
        dependents.push(task);
        dependentsOf.set(dependencyId, dependents);
      }
    }

    const toSkip: ExecutionTask[] = [];
    const seen = new Set<string>();
    const queue = [...(dependentsOf.get(failedTask.id) ?? [])];

    while (queue.length > 0) {
      const task = queue.shift() as ExecutionTask;
      if (seen.has(task.id)) {
        continue;
      }
      seen.add(task.id);

      if (!task.isTerminal()) {
        toSkip.push(task);
      }
      queue.push(...(dependentsOf.get(task.id) ?? []));
    }

    return toSkip;
  }
}
