# Milestone 31.1 Phase 11-12 — Monitoring Decision, Implementation & Alert Verification

**Honest scope statement, up front**: this phase builds the real, provider-agnostic abstraction and
wires real, live-verified metric emission into representative call sites — it does **not** and
cannot claim "monitoring is operational" per this milestone's own explicit instruction ("Do not
declare monitoring operational if it only logs to the local console"). Structured JSON log lines
are real (live-verified below), but nothing aggregates, dashboards, or alerts on them yet — that
requires the vendor decision in §3.

## 1. What was built (real, live-verified)

- **`MetricsPort`** (`shared/infrastructure/observability/metrics/metrics.port.ts`) — a small,
  provider-agnostic interface (`incrementCounter`/`recordGauge`/`recordHistogram`, the same 3
  primitives every real metrics backend from Prometheus to a hosting platform's own metrics
  already speaks), bound in `ObservabilityModule` (the same global seam as the structured logger)
  so swapping in a real vendor's adapter later is a one-line provider-binding change, never a
  call-site change.
- **`ConsoleMetricsAdapter`** — the only adapter that exists today, explicitly documented in its
  own doc comment as NOT constituting operational monitoring by itself.
- **Real instrumentation at 2 representative call sites**, proving the abstraction actually
  connects to live application code rather than existing as an unused interface:
  - `EmailQueueWorkerService` — `email_queue.claimed_batch_size` (gauge, every tick),
    `email_queue.tick_failures` (counter, on error) — doc 13's "Queue depth" catalogue entry.
  - `EmailWebhookProcessingService` — `email_webhook.outcome` (counter, tagged by
    provider+outcome, every one of the 6 real outcomes) — doc 13's "Webhook failures" entry.
- **Live-verified against the real running dev server** (not just unit-tested): a fresh server
  restart, watched for 30 real seconds of live tick activity, confirmed real structured
  `{"metricType":"gauge","name":"email_queue.claimed_batch_size",...}` log lines emitted on every
  5-second tick, exactly as designed.
- **19 new unit tests** across the touched files (webhook processing service, both inbox webhook
  controllers, email queue worker — 3 of which had ZERO test coverage before this phase, a real
  gap found while wiring metrics into them, closed alongside). Full suite re-confirmed clean:
  202/202 backend suites, 1,330/1,330 tests.

## 2. Full metric catalogue instrumentation status

Doc 13/19's catalogues name ~35 real metrics. This phase instruments 3 of them end-to-end (queue
depth via batch size, tick failures, webhook outcomes) as a proof of the seam — instrumenting the
remaining ~32 is real, mechanical, low-risk follow-up work (the pattern is now established and
copy-paste-simple: inject `METRICS_PORT`, call the right primitive at the right point) that a
future pass should complete once a real vendor is chosen and the actual metric names/tags can be
validated against that vendor's own conventions (e.g., some vendors prefer dotted names, others
underscore; deciding this now, before a vendor exists, risks picking a convention that has to be
renamed later).

## 3. DECISION REQUIRED

**Decision:**
Monitoring/metrics vendor.

**Why:**
Real Closed Beta operation needs someone to actually notice when something breaks — structured
logs exist and are real, but nothing today aggregates them into a dashboard or pages anyone.

**Recommended option:**
**Grafana Cloud (free tier)** — genuinely free at Closed Beta's real scale (free tier covers
10k metrics series, 50GB logs, real alerting/dashboards), accepts both metrics (via a Prometheus
remote-write endpoint or the OpenTelemetry protocol) and logs (via Loki), and every hosting option
in doc 30 can reach it over plain HTTPS with no special network setup. Integrating it is exactly
the "swap `ConsoleMetricsAdapter` for a real adapter implementing the same `MetricsPort`" step
this phase's own architecture was built for.

**Alternative:**
The chosen hosting provider's own built-in metrics/log dashboard, if Phase 3's hosting decision
lands on Render or Railway (both have real, built-in service metrics/log views at no extra cost) —
lower integration effort (nothing to wire, it's automatic for CPU/memory/request metrics), but
does not cover this application's own domain-specific metrics (queue depth, webhook outcomes,
OAuth failures) without still building the `MetricsPort` adapter this phase already prepared.
A reasonable Stage 0 choice: use the hosting platform's built-in view for infrastructure metrics
immediately (zero setup), and add Grafana Cloud (or an equivalent) for domain-specific metrics/
alerting once real Staging traffic exists to make dashboard design meaningful.

**Expected cost:**
$0/month at Closed Beta scale for either option's free/included tier.

**Security implications:**
Metrics/log data must never include CV content, email bodies, or tokens (doc 19 §1 — this
constraint doesn't change with vendor choice, and this phase's own 3 instrumented metrics already
comply: batch sizes, failure counts, and provider+outcome tags only, never message content or
user-identifying data).

**What I need from Product Owner:**
Choose Grafana Cloud, the hosting platform's built-in view, a different vendor, or "wait until
Staging exists" — then, if a vendor requiring an account is chosen, create that account (free
tier requires no payment method for Grafana Cloud specifically, but still requires a real sign-up
Claude cannot perform).

**Work completed independently:**
The full `MetricsPort` abstraction, live-verified real instrumentation at 2 representative call
sites, and the 19 tests that came with closing 3 real, previously-uncovered gaps found along the way.

**Blocked next steps:**
Phase 12 (Alert Verification) — triggering a safe synthetic incident and proving
`incident → metric/log → alert condition → alert delivered → operator sees actionable context` end
to end requires a real alerting destination to exist first. **Nothing to verify yet**: with only
`ConsoleMetricsAdapter` bound, there is no alert delivery mechanism at all — this is not a gap in
this phase's own work, it is the literal, honest state of "no vendor chosen yet." Doc 23's own
earlier real failure-scenario simulation (a genuine Postgres outage, induced and observed via
`/health`/`/ready`) remains the closest real evidence this codebase has of "a real incident
produces the correct observable signal" until a real alerting destination exists to extend that
proof to "...and someone gets paged."
