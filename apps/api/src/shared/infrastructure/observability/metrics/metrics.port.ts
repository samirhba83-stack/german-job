export const METRICS_PORT = Symbol('METRICS_PORT');

/** A free-form, low-cardinality key/value set — provider names, outcome types, environment.
 * Never a user id, email, or anything with unbounded cardinality (that belongs in a log line with
 * a request id, not a metric tag — the same "counts/status/duration, never content" discipline
 * doc 19's Product Telemetry Catalogue already applies to product metrics applies here too). */
export type MetricTags = Readonly<Record<string, string | number | boolean>>;

/**
 * M31.1 Phase 11 — the real, provider-agnostic seam every metric in doc 13/19's catalogue is
 * meant to be recorded through. Deliberately small (3 primitives — counter/gauge/histogram, the
 * same vocabulary every real metrics backend from Prometheus to a hosting platform's own built-in
 * metrics already speaks) so swapping the DEFAULT `ConsoleMetricsAdapter` for a real vendor's SDK
 * once one is chosen (Phase 11's own DECISION REQUIRED) is a single provider-binding change in
 * `observability.module.ts`, never a call-site change anywhere this port is injected.
 */
export interface MetricsPort {
  /** A monotonically-increasing count — "how many times has X happened" (webhook outcomes, auth
   * failures, OAuth failures). */
  incrementCounter(name: string, tags?: MetricTags): void;

  /** A point-in-time value that can go up or down — "what is X right now" (queue depth, active
   * connections). */
  recordGauge(name: string, value: number, tags?: MetricTags): void;

  /** A distribution of observed values — "how long did X take" (request latency, webhook
   * processing latency). */
  recordHistogram(name: string, value: number, tags?: MetricTags): void;
}
