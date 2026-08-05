export const EXECUTION_QUEUE = Symbol('EXECUTION_QUEUE');

export interface EnqueueOptions {
  /** Delay, in milliseconds, before the message becomes eligible for dequeue. */
  delayMs?: number;
}

export interface QueuedMessage<T> {
  readonly id: string;
  readonly payload: T;
  readonly enqueuedAt: Date;
  /** Number of times this message has been dequeued, including the current dequeue. */
  readonly attempts: number;
}

/**
 * Abstracts the work queue a future Dispatcher/Worker layer (M3+) will pull execution
 * jobs from. A dequeued message stays invisible to other consumers until it is
 * acknowledged (permanently removed) or released (made eligible again) — callers are
 * responsible for calling one or the other for every message they dequeue.
 */
export interface ExecutionQueue<T> {
  enqueue(payload: T, options?: EnqueueOptions): Promise<string>;
  dequeue(): Promise<QueuedMessage<T> | null>;
  acknowledge(messageId: string): Promise<void>;
  release(messageId: string): Promise<void>;
  size(): Promise<number>;
}
