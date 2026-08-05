import { ExecutionClock } from '../../domain/ports/execution-clock.port';

/** Deterministic clock for tests. Not registered as a Nest provider — construct it directly. */
export class FixedClock implements ExecutionClock {
  private current: Date;

  constructor(initial: Date) {
    this.current = initial;
  }

  now(): Date {
    return this.current;
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  set(date: Date): void {
    this.current = date;
  }
}
