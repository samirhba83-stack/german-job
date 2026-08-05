import { InMemoryExecutionQueue } from './in-memory-execution-queue';
import { FixedClock } from '../clock/fixed-clock';

describe('InMemoryExecutionQueue', () => {
  it('returns null when dequeuing an empty queue', async () => {
    const queue = new InMemoryExecutionQueue<string>(new FixedClock(new Date('2026-01-01T00:00:00.000Z')));

    await expect(queue.dequeue()).resolves.toBeNull();
  });

  it('dequeues an enqueued message with attempts starting at 1', async () => {
    const queue = new InMemoryExecutionQueue<{ jobId: string }>(new FixedClock(new Date('2026-01-01T00:00:00.000Z')));

    const id = await queue.enqueue({ jobId: 'job-1' });
    const message = await queue.dequeue();

    expect(message).not.toBeNull();
    expect(message!.id).toBe(id);
    expect(message!.payload).toEqual({ jobId: 'job-1' });
    expect(message!.attempts).toBe(1);
  });

  it('does not redeliver an in-flight message until it is released', async () => {
    const queue = new InMemoryExecutionQueue<string>(new FixedClock(new Date('2026-01-01T00:00:00.000Z')));
    await queue.enqueue('payload-1');

    await queue.dequeue();

    await expect(queue.dequeue()).resolves.toBeNull();
  });

  it('makes a released message eligible again with an incremented attempt count', async () => {
    const queue = new InMemoryExecutionQueue<string>(new FixedClock(new Date('2026-01-01T00:00:00.000Z')));
    await queue.enqueue('payload-1');
    const first = await queue.dequeue();

    await queue.release(first!.id);
    const second = await queue.dequeue();

    expect(second!.id).toBe(first!.id);
    expect(second!.attempts).toBe(2);
  });

  it('permanently removes a message on acknowledge', async () => {
    const queue = new InMemoryExecutionQueue<string>(new FixedClock(new Date('2026-01-01T00:00:00.000Z')));
    await queue.enqueue('payload-1');
    const message = await queue.dequeue();

    await queue.acknowledge(message!.id);

    expect(await queue.size()).toBe(0);
  });

  it('honors delayMs by hiding the message from dequeue until the clock reaches readyAt', async () => {
    const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
    const queue = new InMemoryExecutionQueue<string>(clock);

    await queue.enqueue('delayed-payload', { delayMs: 10_000 });

    await expect(queue.dequeue()).resolves.toBeNull();

    clock.advance(10_000);

    await expect(queue.dequeue()).resolves.toMatchObject({ payload: 'delayed-payload' });
  });

  it('dequeues the oldest ready message first (FIFO)', async () => {
    const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
    const queue = new InMemoryExecutionQueue<string>(clock);

    await queue.enqueue('first');
    clock.advance(1);
    await queue.enqueue('second');

    const message = await queue.dequeue();

    expect(message!.payload).toBe('first');
  });

  it('reports size including in-flight messages but excluding acknowledged ones', async () => {
    const queue = new InMemoryExecutionQueue<string>(new FixedClock(new Date('2026-01-01T00:00:00.000Z')));
    await queue.enqueue('a');
    await queue.enqueue('b');
    const message = await queue.dequeue();

    expect(await queue.size()).toBe(2);

    await queue.acknowledge(message!.id);

    expect(await queue.size()).toBe(1);
  });
});
