import { Injectable, Logger } from '@nestjs/common';
import { MetricsPort, MetricTags } from './metrics.port';

/**
 * M31.1 Phase 11 — the ONLY adapter this codebase has today. Emits a real structured log line per
 * metric event (so the data exists and is real, not fabricated) — but this is explicitly NOT
 * "operational monitoring" per this milestone's own instruction ("Do not declare monitoring
 * operational if it only logs to the local console"). Nothing aggregates these lines into a
 * dashboard, nothing alerts on them, and nothing survives past whatever log retention the
 * deployment happens to have. This class exists so `MetricsPort` has a safe, real, zero-dependency
 * default in every environment (including local dev, where no metrics vendor will ever be wired)
 * — not as a substitute for choosing and integrating a real one before claiming Closed Beta has
 * real monitoring (Phase 11's own DECISION REQUIRED covers exactly this gap).
 */
@Injectable()
export class ConsoleMetricsAdapter implements MetricsPort {
  private readonly logger = new Logger('Metrics');

  incrementCounter(name: string, tags?: MetricTags): void {
    this.logger.log({ metricType: 'counter', name, value: 1, tags: tags ?? {} });
  }

  recordGauge(name: string, value: number, tags?: MetricTags): void {
    this.logger.log({ metricType: 'gauge', name, value, tags: tags ?? {} });
  }

  recordHistogram(name: string, value: number, tags?: MetricTags): void {
    this.logger.log({ metricType: 'histogram', name, value, tags: tags ?? {} });
  }
}
