# Milestone 31 Phase 15-16 — Observability, Health, and Readiness

## Phase 16 — health/readiness/liveness (built and verified live earlier in this milestone, Phase 4)

Covered in `docs/production-certification/04-cicd-and-release-versioning.md` and the Phase 4
section of the main audit — `GET /health`, `GET /ready` (real DB round-trip + the same
`EnvironmentValidationService` rules the app refuses to boot without), `GET /live` (zero
dependency checks, by design). Not repeated here.

## Phase 15 — structured logging (real, built and live-verified this pass)

Replaced the placeholder `LoggerModule` (Phase 1 audit finding — an explicit "uses Nest's built-in
Logger for now" comment had stood since the module was first scaffolded) with a real
`StructuredLoggerService`.

**How it reaches the entire application with zero call-site changes**: NestJS's `Logger` class
(what every one of the hundreds of `new Logger(SomeClass.name)` call sites across M20-M30 already
uses) delegates its instance methods to a single, class-level `Logger.staticInstanceRef` —
`app.useLogger(customLogger)` overwrites that reference. Verified by reading `@nestjs/common`'s
own compiled source (not assumed) before relying on it, and confirmed live: after wiring
`app.useLogger()` into `main.ts`, every boot-time log line — Nest's own internal
`RouterExplorer`/`RoutesResolver` messages AND this application's own service logs
(`EmailQueueWorkerService`, `RecruitmentOperationsTickDriverService`, etc., none of which were
touched) — came out as real JSON:

```json
{"timestamp":"2026-08-06T13:13:35.113Z","level":"log","context":"EmailQueueWorkerService","message":"Email queue tick registered every 5000ms.","environment":"development"}
```

**Self-caught mistake while building this**: the first attempt overrode `ConsoleLogger`'s
`formatMessage()` — which only ever receives the context/pid/level pieces AFTER they've already
been wrapped in ANSI color codes for terminal display, unsuitable for clean JSON. Corrected to
override `printMessages()` instead, which receives the raw `context` string before that wrapping —
confirmed by reading the actual compiled implementation, not by guessing at the API surface.

**Request IDs**: `RequestContextMiddleware` (applied globally via `ObservabilityModule.configure()`)
reuses an inbound `X-Request-Id` header if present (so an id stays stable across services once a
real topology exists), otherwise mints a fresh UUID; echoed back on the response — verified live
(`curl -D -` showed a real `X-Request-Id` header on every response). Every log line for that
request automatically carries it via the same `AsyncLocalStorage` pattern this codebase already
established in M26 (`CampaignExecutionCallContextHolder`) — reused, not reinvented.

**User references**: `RequestContextUserInterceptor` (global) attaches the authenticated user's id
(never email) to the active request context once auth resolves — a no-op for unauthenticated
routes.

**Correlation/trace/campaign/application/provider IDs**: already real and already flow through
this codebase's own domain-level `correlationId` mechanism (every M26-M30 command carries one) —
this milestone's new HTTP-level `requestId` is a complementary, narrower concept (one HTTP request,
not one business operation that might span several) and does not replace it.

## What's NOT done this pass (real, honest gaps)

- **No real log-aggregation destination** — logs are real, structured JSON on stdout/stderr (the
  correct shape for any real aggregator to ingest), but nothing ships them anywhere yet; choosing
  a real destination is a hosting/vendor decision (Phase 3/17).
- **No metrics/dashboards** — see the Metrics Catalogue below for what SHOULD be measured; nothing
  is instrumented yet, since there's no real metrics backend to send to.
- **No redaction filter** — this codebase's real guarantee is that no call site ever constructs a
  log message containing raw email/CV/token content in the first place (confirmed by this
  session's own discipline across 10+ milestones); this logger does not add a second, pattern-
  matching safety net on top of that, since a regex-based scanner over arbitrary strings would be
  unreliable and could create false confidence rather than real safety.

See `docs/production-certification/13-alerting-and-metrics-catalogue.md` for the full metrics/alert
catalogue.
