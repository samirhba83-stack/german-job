/**
 * The real, stable identity of "the" worker performing task execution
 * (M18). This is not a fabricated value — the platform genuinely has
 * exactly one in-process WorkerService today, so naming it honestly
 * reflects reality rather than inventing a fake worker-pool concept that
 * doesn't exist yet. Whenever a real distributed worker pool is
 * introduced, this becomes an injected identity instead of a constant.
 */
export const DEFAULT_WORKER_ID = 'worker-default';
