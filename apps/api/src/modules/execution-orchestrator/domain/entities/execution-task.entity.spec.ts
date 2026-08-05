import { ExecutionTask } from './execution-task.entity';
import { InvalidTaskStatusTransitionException } from '../exceptions/invalid-task-status-transition.exception';

const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildTask(dependsOn: string[] = []): ExecutionTask {
  return ExecutionTask.create('task-1', 'BATCH_EXECUTION', 'Test task', 'Test explanation.', dependsOn, dependsOn.length === 0 ? 'READY' : 'PENDING', 'correlation-1', NOW);
}

describe('ExecutionTask', () => {
  it('starts READY when it has no dependencies', () => {
    expect(buildTask([]).status).toBe('READY');
  });

  it('starts PENDING when it has dependencies', () => {
    expect(buildTask(['task-0']).status).toBe('PENDING');
  });

  it('carries the correlationId it was created with', () => {
    expect(buildTask([]).correlationId).toBe('correlation-1');
  });

  describe('markReady', () => {
    it('transitions PENDING -> READY', () => {
      const task = buildTask(['task-0']);
      task.markReady();
      expect(task.status).toBe('READY');
    });

    it('refuses when not PENDING', () => {
      const task = buildTask([]);
      expect(() => task.markReady()).toThrow(InvalidTaskStatusTransitionException);
    });
  });

  describe('markRunning', () => {
    it('transitions READY -> RUNNING and records startedAt', () => {
      const task = buildTask([]);
      task.markRunning(NOW);
      expect(task.status).toBe('RUNNING');
      expect(task.startedAt).toEqual(NOW);
    });

    it('refuses when not READY', () => {
      const task = buildTask(['task-0']); // PENDING
      expect(() => task.markRunning(NOW)).toThrow(InvalidTaskStatusTransitionException);
    });
  });

  describe('markCompleted', () => {
    it('transitions RUNNING -> COMPLETED and records finishedAt', () => {
      const task = buildTask([]);
      task.markRunning(NOW);
      const finishedAt = new Date(NOW.getTime() + 1000);
      task.markCompleted(finishedAt);
      expect(task.status).toBe('COMPLETED');
      expect(task.finishedAt).toEqual(finishedAt);
    });

    it('refuses when not RUNNING', () => {
      const task = buildTask([]);
      expect(() => task.markCompleted(NOW)).toThrow(InvalidTaskStatusTransitionException);
    });
  });

  describe('markFailed', () => {
    it('transitions RUNNING -> FAILED and records the failure reason', () => {
      const task = buildTask([]);
      task.markRunning(NOW);
      task.markFailed('timeout', NOW);
      expect(task.status).toBe('FAILED');
      expect(task.failureReason).toBe('timeout');
      expect(task.finishedAt).toEqual(NOW);
    });

    it('refuses when not RUNNING', () => {
      const task = buildTask([]);
      expect(() => task.markFailed('timeout', NOW)).toThrow(InvalidTaskStatusTransitionException);
    });
  });

  describe('markSkipped', () => {
    it('transitions PENDING -> SKIPPED', () => {
      const task = buildTask(['task-0']);
      task.markSkipped('dependency failed', NOW);
      expect(task.status).toBe('SKIPPED');
      expect(task.failureReason).toBe('dependency failed');
    });

    it('transitions READY -> SKIPPED', () => {
      const task = buildTask([]);
      task.markSkipped('no longer needed', NOW);
      expect(task.status).toBe('SKIPPED');
    });

    it('refuses when RUNNING', () => {
      const task = buildTask([]);
      task.markRunning(NOW);
      expect(() => task.markSkipped('x', NOW)).toThrow(InvalidTaskStatusTransitionException);
    });
  });

  describe('markCancelled', () => {
    it.each(['PENDING', 'READY', 'RUNNING'] as const)('cancels from %s', (from) => {
      const task = buildTask(from === 'PENDING' ? ['task-0'] : []);
      if (from === 'RUNNING') {
        task.markRunning(NOW);
      }
      task.markCancelled(NOW);
      expect(task.status).toBe('CANCELLED');
    });

    it.each(['COMPLETED', 'FAILED', 'SKIPPED'] as const)('refuses once terminal (%s)', (terminalStatus) => {
      const task = buildTask([]);
      task.markRunning(NOW);
      if (terminalStatus === 'COMPLETED') task.markCompleted(NOW);
      if (terminalStatus === 'FAILED') task.markFailed('x', NOW);
      if (terminalStatus === 'SKIPPED') {
        // SKIPPED is unreachable from RUNNING; use a fresh READY task instead.
        const readyTask = buildTask([]);
        readyTask.markSkipped('x', NOW);
        expect(() => readyTask.markCancelled(NOW)).toThrow(InvalidTaskStatusTransitionException);
        return;
      }
      expect(() => task.markCancelled(NOW)).toThrow(InvalidTaskStatusTransitionException);
    });
  });

  describe('isTerminal', () => {
    it.each(['COMPLETED', 'FAILED', 'SKIPPED', 'CANCELLED'])('is true for %s', (status) => {
      const task = buildTask([]);
      if (status === 'COMPLETED') {
        task.markRunning(NOW);
        task.markCompleted(NOW);
      } else if (status === 'FAILED') {
        task.markRunning(NOW);
        task.markFailed('x', NOW);
      } else if (status === 'SKIPPED') {
        task.markSkipped('x', NOW);
      } else {
        task.markCancelled(NOW);
      }
      expect(task.isTerminal()).toBe(true);
    });

    it.each(['PENDING', 'READY', 'RUNNING'])('is false for %s', (status) => {
      const task = buildTask(status === 'PENDING' ? ['task-0'] : []);
      if (status === 'RUNNING') {
        task.markRunning(NOW);
      }
      expect(task.isTerminal()).toBe(false);
    });
  });
});
