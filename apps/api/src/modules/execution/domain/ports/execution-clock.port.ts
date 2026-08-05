export const EXECUTION_CLOCK = Symbol('EXECUTION_CLOCK');

/** Abstracts wall-clock access so execution-engine logic (M3+) can be driven by a fixed time in tests. */
export interface ExecutionClock {
  now(): Date;
}
