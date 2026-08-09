import { registerAs } from '@nestjs/config';

/** M31 Phase 2/3/26 — `environment` is the real, validated (see `EnvironmentValidationService`,
 * Phase 7) identity of this running process: `development` | `staging` | `production`. Deliberately
 * distinct from `NODE_ENV` (a Node/framework-level build-mode switch, e.g. disabling Express's dev
 * error pages) — `environment` is this application's own concept of which of the 3 fully-separate
 * environments (docs/production-certification/02-environment-architecture.md) it's running in, and
 * is what gates Production-only behavior (HSTS, hiding Swagger, etc. — main.ts) and is attached to
 * every structured log line and the `/version` endpoint. Defaults to the safest, most-restrictive
 * value (`development`) — an unset/misconfigured `APP_ENVIRONMENT` in a real deployment fails
 * toward extra logging/exposed docs, never toward silently unlocking Production-only behavior.
 *
 * `runTicks` — the real "Worker/Scheduler is its own process" switch (Phase 3 topology). Defaults
 * `true` so today's single-process deployment (and every existing dev/test workflow) keeps working
 * completely unchanged; a real split-process topology explicitly sets `RUN_TICKS=false` on API
 * replicas and leaves it `true` (or unset) on the one instance responsible for scheduled work. Every
 * tick-driver service (`EmailQueueWorkerService`, `ExecutionTickDriverService`,
 * `InboxPollingTickDriverService`, `InboxWatchRenewalTickDriverService`,
 * `RecruitmentOperationsTickDriverService`) checks this before registering itself. */
export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  environment: (process.env.APP_ENVIRONMENT ?? 'development') as 'development' | 'staging' | 'production',
  // M31 Phase 8 — a comma-separated list, not a single string: the real production topology
  // (docs/production-certification/02-environment-architecture.md) is multiple subdomains
  // (app.<domain>, and Staging needs its own separate origin from Production) — Nest's
  // `enableCors({ origin })` natively accepts a string[] with no further code change, so this is
  // the one place that needs to change, not `main.ts`. A single origin (today's default) still
  // works unchanged — `'http://localhost:3000'.split(',')` is just `['http://localhost:3000']`.
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map((origin) => origin.trim()),
  // Self-caught (found while making the above change): a real user-facing redirect target (e.g.
  // `MailboxOAuthCallbackController` sending the browser back to `/settings` after an OAuth
  // completion) is a DIFFERENT concept from "which origins may make a cross-origin API request" —
  // they only ever shared one value because `corsOrigin` used to be a single string. Now that CORS
  // legitimately supports multiple origins, a redirect needs its OWN single, unambiguous target;
  // defaults to the first CORS origin so existing single-origin deployments need no new env var.
  frontendUrl: process.env.FRONTEND_URL ?? (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',')[0].trim(),
  runTicks: (process.env.RUN_TICKS ?? 'true').toLowerCase() === 'true',
}));
