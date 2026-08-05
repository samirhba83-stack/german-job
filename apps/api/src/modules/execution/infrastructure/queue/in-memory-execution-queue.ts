import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { EnqueueOptions, ExecutionQueue, QueuedMessage } from '../../domain/ports/execution-queue.port';
import { ExecutionClock, EXECUTION_CLOCK } from '../../domain/ports/execution-clock.port';
import { SystemClock } from '../clock/system-clock';

interface InternalMessage<T> {
  id: string;
  payload: T;
  enqueuedAt: Date;
  readyAt: Date;
  attempts: number;
  inFlight: boolean;
}

/**
 * Single-process, in-memory execution queue. Suitable for local development and for a
 * future single-instance deployment; not durable across restarts and not shared across
 * processes. A distributed implementation (e.g. backed by Postgres or Redis) can replace
 * this behind the same `ExecutionQueue` port without touching any caller.
 */
@Injectable()
export class InMemoryExecutionQueue<T> implements ExecutionQueue<T> {
  private readonly messages = new Map<string, InternalMessage<T>>();

  constructor(@Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock = new SystemClock()) {}

  async enqueue(payload: T, options?: EnqueueOptions): Promise<string> {
    const id = randomUUID();
    const now = this.clock.now();
    const readyAt = options?.delayMs ? new Date(now.getTime() + options.delayMs) : now;

    this.messages.set(id, {
      id,
      payload,
      enqueuedAt: now,
      readyAt,
      attempts: 0,
      inFlight: false,
    });

    return id;
  }

  async dequeue(): Promise<QueuedMessage<T> | null> {
    const now = this.clock.now();
    let candidate: InternalMessage<T> | null = null;

    for (const message of this.messages.values()) {
      if (message.inFlight || message.readyAt.getTime() > now.getTime()) {
        continue;
      }
      if (!candidate || message.enqueuedAt.getTime() < candidate.enqueuedAt.getTime()) {
        candidate = message;
      }
    }

    if (!candidate) {
      return null;
    }

    candidate.inFlight = true;
    candidate.attempts += 1;

    return {
      id: candidate.id,
      payload: candidate.payload,
      enqueuedAt: candidate.enqueuedAt,
      attempts: candidate.attempts,
    };
  }

  async acknowledge(messageId: string): Promise<void> {
    this.messages.delete(messageId);
  }

  async release(messageId: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (!message) {
      return;
    }
    message.inFlight = false;
    message.readyAt = this.clock.now();
  }

  async size(): Promise<number> {
    return this.messages.size;
  }
}
