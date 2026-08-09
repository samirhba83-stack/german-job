import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RequestContextService } from './request-context.service';
import { RequestContextMiddleware } from './request-context.middleware';
import { StructuredLoggerService } from './structured-logger.service';
import { METRICS_PORT } from './metrics/metrics.port';
import { ConsoleMetricsAdapter } from './metrics/console-metrics.adapter';

/** M31 Phase 15 — real observability infrastructure: request IDs (`RequestContextService`/
 * `RequestContextMiddleware`) and structured JSON logging (`StructuredLoggerService`). `@Global()`
 * so `RequestContextService` is reachable from every module without each one needing its own
 * import — deliberately the one exception to this session's own established "explicitly import
 * even global modules" self-containedness lesson (M30), because `RequestContextService` needs to
 * be usable from the SAME middleware layer that runs before routing/module-scoped DI resolution
 * even begins; `ConfigModule` is still explicitly imported per that same lesson, since nothing
 * about StructuredLoggerService's own need for it is time-sensitive the way the middleware wiring
 * is.
 *
 * M31.1 Phase 11 — `METRICS_PORT` bound to `ConsoleMetricsAdapter` (the only adapter that exists
 * today — see its own doc comment for why this is NOT "operational monitoring" by itself). Bound
 * here, at the same global seam as the logger, so swapping in a real vendor's adapter later is a
 * one-line change in exactly one place — no call site anywhere else in this codebase changes. */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    RequestContextService,
    RequestContextMiddleware,
    StructuredLoggerService,
    { provide: METRICS_PORT, useClass: ConsoleMetricsAdapter },
  ],
  exports: [RequestContextService, StructuredLoggerService, METRICS_PORT],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
