# Milestone 31 Phase 1 — Production Readiness Audit

Real findings from direct inspection of the running codebase (not assumptions), cross-referenced
against 10 milestones of accumulated domain knowledge (M20–M30 were all built in this same
engineering effort). Every finding below names the exact file and the exact gap.

## 1. Monorepo / build

- Turborepo + pnpm workspaces, 2 apps (`apps/api`, `apps/web`), 3 shared packages (`database`,
  `shared-types`, `config`). Structure is sound and unchanged in shape since the original scaffold.
- `package.json` scripts (`apps/api`) already distinguish `start:dev`/`start:prod`/`build` —
  correctly shaped for a real deploy, just never exercised outside `pnpm --filter api start:dev`
  this entire project.
- **No `output: 'standalone'` in `apps/web/next.config.js`** — the web Dockerfile's `pnpm start`
  therefore needs the full, unpruned `node_modules` tree at runtime, not Next's own minimal
  standalone server bundle. Real image-size and attack-surface gap.

## 2. Backend application

- NestJS, CQRS, Clean Architecture per-module (`domain/application/infrastructure/presentation`),
  consistently applied across all 25 mounted modules. Structurally production-shaped.
- `main.ts` (`apps/api/src/main.ts`):
  - **`app.enableShutdownHooks()` is never called.** Every `OnModuleDestroy` hook in this codebase
    (all 6 tick-driver services' interval cleanup, `PrismaService.onModuleDestroy()`) is dead code
    on a real SIGTERM/SIGINT today — Nest only invokes lifecycle shutdown hooks when this is
    explicitly enabled. A real container orchestrator sending SIGTERM on redeploy/scale-down gets
    an ungraceful kill, not a drain.
  - **Swagger (`/api/docs`) is mounted unconditionally**, in every environment, with the full API
    surface (every DTO, every route, including admin routes) and no auth gate. Real information-
    disclosure exposure the moment this is reachable from the public internet.
  - No `helmet` or equivalent security-headers middleware.
  - No explicit request body size limit beyond Express/Nest defaults.
  - CORS origin is a single configurable string (`app.corsOrigin`) — works for one frontend origin,
    not yet verified for a multi-subdomain (`app.`/`api.`/`webhooks.`) production topology.
- `/health` (`modules/health/health.controller.ts`) is a **static M11-era stub**:
  `return { status: 'ok', timestamp: ... }` unconditionally, with zero dependency checks. **There is
  no `/ready` and no `/live` endpoint at all.** A container orchestrator using this as a readiness
  probe would report "ready" even with the database fully unreachable.
- Global rate limiting: `ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])` — 100 requests/
  minute default. **Correction to an earlier draft of this audit**: `/auth/register` and
  `/auth/login` already carry real, stricter per-route `@Throttle()` overrides (5/min and 10/min
  respectively) — found on closer inspection during Phase 8, not a gap. The OAuth mailbox-connection
  start endpoint (`POST /mailbox-connections/:provider/start`) has no additional throttling beyond
  the global default, but is already behind `JwtAuthGuard` (authenticated users only), which
  meaningfully narrows its abuse surface compared to the fully public auth endpoints — a lower-
  priority, real but non-blocking hardening item, not added this pass.
- **No env-var validation at startup anywhere** (no Joi/Zod/`ConfigModule` validation schema). JWT
  secrets, encryption keys, OAuth client secrets, and Paddle keys all read via
  `process.env.X` with `undefined` as the silent fallback when unset — the app boots successfully
  either way and only fails later, at first real use, often with a confusing downstream error
  rather than a clear boot-time refusal. Directly violates Non-Negotiable Principle #19
  ("fail-closed").
- Logging (`shared/infrastructure/logger/logger.module.ts`) is **explicitly a placeholder**: `/**
  Placeholder for a structured logger provider (e.g. Pino/Winston) — uses Nest's built-in Logger for
  now. */`. No structured (JSON) logs, no request-ID middleware, no correlation-ID propagation at
  the HTTP-transport level (individual command flows DO carry a domain `correlationId`, but that's
  a separate, narrower concept from request-level observability), no log redaction guarantees beyond
  each module's own discipline about what it passes to its logger calls.

## 3. Frontend application

- Next.js App Router, real feature-sliced structure, consistent with the locked
  `docs/frontend-architecture/` blueprint. No production-specific gaps found beyond the Docker/env
  concerns in §1/§7.

## 4. PostgreSQL / Prisma

- One real database, one Prisma schema, 30 migrations to date, all additive (confirmed: no
  destructive migration has ever been applied in this project's history).
- No connection-pool sizing, statement-timeout, or idle-transaction-timeout configuration anywhere
  — `DATABASE_URL` is used as-is; Prisma's defaults apply unmodified.
- No slow-query monitoring/logging configured.
- Real, proven concurrency backstops exist widely (partial unique indexes, `idempotencyKey`
  columns, conditional `updateMany` claims) — this is a genuine strength carried through every
  milestone since M26, not a gap.

## 5. MinIO / object storage

- Real MinIO container in `docker-compose.yml`, real `MinioStorageAdapter`
  (`documents/infrastructure/adapters/minio-storage.adapter.ts`), bucket auto-created on boot.
- Console port (9001) is exposed on the host in the dev compose file — must not be replicated in any
  production topology (see Phase 8 checklist).
- No backup mechanism for object storage exists today (see Phase 13 — real gap, not yet fixed).

## 6. Redis / queue infrastructure

- **No Redis, and no external message queue, exist anywhere in this codebase.** The only "queue"
  artifact is `execution/infrastructure/queue/in-memory-execution-queue.ts` — confirmed dead code,
  superseded since M26 by the real interval-tick + Postgres-distributed-lock pattern
  (`CampaignExecutionEntryPointService`). This is an intentional, working architectural choice for
  this codebase's actual scale, not an unfinished gap — documented here so no future session
  mistakes the in-memory queue class for a real, live path.

## 7. Background workers / cron / scheduler

- **All scheduled work runs as `setInterval` + `SchedulerRegistry` inside the single API process** —
  confirmed 6 tick-driver services: `EmailQueueWorkerService` (5s), `ExecutionTickDriverService`
  (30s), `InboxPollingTickDriverService` (2m), `InboxWatchRenewalTickDriverService` (1h),
  `RecruitmentOperationsTickDriverService` (2 ticks, 30m/15m). **No separate Worker or Scheduler
  process exists** — directly contradicts Phase 3's explicit "separate API/Worker/Scheduler process
  roles" requirement.
- **Leader-election / lock coverage is uneven across the 6 ticks — real finding, by tick:**
  - `ExecutionTickDriverService` (campaign dispatch, highest stakes): **safe** — each campaign's
    real work is individually gated by `CampaignExecutionEntryPointService`'s real Postgres
    distributed lock (`campaign-execution:{campaignId}`, M26). Two replicas racing the same tick
    would both attempt the same campaign; only one wins the lock, the other's attempt fails closed
    and is retried next tick.
  - `EmailQueueWorkerService` (real sends): **safe** — `PrismaEmailQueueRepository.claimBatch()`
    uses the same conditional `updateMany` claim pattern; a losing replica claims zero rows.
  - `RecruitmentOperationsTickDriverService`'s two ticks, `InboxPollingTickDriverService`,
    `InboxWatchRenewalTickDriverService`: **each only guards re-entrancy within its OWN process**
    (a plain `running` boolean), with **no cross-process lock**. Two replicas would each run their
    own full pass. Downstream writes are still individually idempotent (proven under concurrency:
    `ApplicationFollowUpControl`/`RecruitmentActionTask`/`InboxMessage` all have real `@unique`
    constraints), so this is NOT a data-corruption risk — but it is real wasted duplicate work,
    duplicate provider API calls (a real rate-limit/cost concern against Gmail/Graph), and duplicate
    audit-log noise the moment more than one API replica ever runs.
  - **Practical mitigation for Closed Beta scale (not a code fix)**: run exactly one API replica.
    Real leader-election/locking for these 4 ticks is real follow-up work required before any
    horizontal scaling — captured in Phase 3's topology recommendation and in Known Limitations.

## 8. Email provider integrations

- Real Resend/SES/SendGrid/SMTP adapters (M28), real Provider Manager failover
  (`EmailProviderManagerService`), real deliverability/suppression handling. Production-shaped;
  needs real provider credentials per environment (Phase 7).

## 9. Gmail OAuth / Microsoft OAuth

- Real OAuth+PKCE flows, real AES-256-GCM envelope-encrypted token vault
  (`connected-mailbox/infrastructure/adapters/aes-gcm-token-vault.adapter.ts`), real separate
  inbox-reading consent layer (M29). **Never tested against real Google/Microsoft credentials or
  real accounts** — every verification to date used synthetic fixtures and mocked provider
  responses. This is the single largest, unavoidable gap standing between this codebase and a real
  verdict of "ready" — see Phases 9–10.

## 10. Gmail Pub/Sub / Microsoft Graph subscriptions

- Real webhook controllers exist (`gmail-inbox-webhook.controller.ts`,
  `microsoft-graph-inbox-webhook.controller.ts`), real signature/`clientState` verification (both
  now `timingSafeEqual`, per M29's own security pass). **Never received a real webhook from Google
  or Microsoft's own infrastructure** — no public HTTPS endpoint has ever existed for either to call.

## 11. Paddle configuration

- Real Paddle sandbox integration (M27), `PADDLE_ENVIRONMENT` defaults to `sandbox`,
  `BILLING_PRODUCTION_PAYMENTS_ENABLED` defaults to `false`. Webhook signature verification is real
  and unit-tested. Never received a real Paddle production webhook (sandbox webhooks were used for
  M27's own verification).

## 12. Webhook endpoints (general)

- Every webhook controller in this codebase independently implements its own authenticity check —
  no shared, centralized "webhook gateway" abstraction. Consistent in intent (each does real
  signature verification) but means a future new webhook integration must remember to replicate the
  pattern rather than inheriting it automatically. Not a defect, a maintainability note.

## 13. Authentication / Authorization

- Real JWT access+refresh, `JwtAuthGuard`/`RolesGuard`, real ownership checks on every resource
  this session's own milestones (M24 through M30) progressively closed the gaps on. No open,
  known authorization gap remains as of M30's own sign-off.
- **No admin bootstrap procedure exists** — how does the FIRST admin user ever get created in a
  fresh production database? No seed script, no CLI command, no documented manual SQL step. Real
  gap: without this, Closed Beta's own admin-invite model (Phase 20) has no way to create its first
  administrator.

## 14. Encryption keys

- Real, versioned envelope encryption for OAuth tokens (`tokenEncryptionVersion` column, AES-256-
  GCM). No key-rotation procedure has ever been exercised (correct code exists to READ a versioned
  key, but no documented rotation runbook exists for WRITING a new version).

## 15. Environment variables

- `.env.example` — 88 declared variables across 150 lines, reasonably complete as a reference, but
  **not validated at startup** (see §2). Single flat file, no environment-specific split
  (`.env.staging.example`/`.env.production.example`) — needed for Phase 2's environment contracts.

## 16. Docker configuration

- `apps/api/Dockerfile` / `apps/web/Dockerfile`: multi-stage ✅, frozen-lockfile ✅, but:
  - **`COPY --from=build /repo /repo`** copies the entire monorepo (every app, every package,
    devDependencies, source TypeScript) into the runtime image — not minimal, real image-bloat and
    unnecessary-attack-surface finding for both images.
  - **No non-root `USER` directive in either image** — both run as root by default.
  - **No `HEALTHCHECK` instruction in either image.**
  - No `--prod`/pruned dependency install step separate from the build-time full install.
  - `docker-compose.yml` exposes MinIO's admin console (port 9001) to the host — fine for dev,
    must never be replicated in a real topology.
  - `docker-compose.prod.yml` exists but is a 200-byte near-empty stub — not a real production
    compose file today.

## 17. Build pipelines / existing CI

- `.github/workflows/ci.yml` is the **original scaffold-era pipeline**: `lint` → `build` → `test`
  only. No e2e, no concurrency tests, no security scanning, no dependency audit, no container build,
  no deployment stage of any kind. Real, substantial Phase 5 gap.

## 18. Existing deployment files

- No Kubernetes manifests, no Terraform/IaC, no Helm charts, no cloud-provider-specific config of
  any kind exist anywhere in the repository. Deployment topology is 100% undecided as of this audit
  — Phase 3 starts from zero, not from an existing-but-outdated choice.

## 19. Logging / Monitoring / Health / Readiness

- See §2 and §16 — all confirmed real gaps, not yet built. Phase 15/16/17 are greenfield work, not
  hardening of something partial.

## 20. Backup procedures / retention jobs

- **No backup procedure exists for PostgreSQL, MinIO, or configuration today** — `docker-compose.yml`
  uses named local volumes only (`postgres_data`, `minio_data`), which are real durability only as
  long as the single Docker host survives; no export/snapshot/offsite step exists.
- Retention: `INBOX_EXCERPT_RETENTION_DAYS` (M29, 90 days) has a real, live, scheduled job
  (`InboxRetentionService` via `InboxWatchRenewalTickDriverService`'s sibling — verified in M29).
  No equivalent retention/deletion job exists yet for candidate documents, audit events, or billing
  records beyond what each table's own schema allows querying for — see Phase 14.

## 21. Production safety flags

- 9 flags already exist and all default `false`/safe, confirmed directly from each milestone's own
  config file: `CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED`, `CONNECTED_INBOX_PROCESSING_ENABLED`,
  `INBOX_AI_CLASSIFICATION_ENABLED`, `INBOX_REPLY_DRAFTING_ENABLED`, `INBOX_AUTOMATIC_REPLY_ENABLED`,
  `REPLY_DRIVEN_EXECUTION_ENABLED`, `FOLLOW_UP_SUPPRESSION_ENABLED`,
  `RECRUITMENT_TASK_AUTOMATION_ENABLED`, `AUTOMATIC_HIGH_IMPACT_TRANSITIONS_ENABLED`. This is a real
  strength — every milestone since M27 has consistently followed this discipline. 4 new flags this
  milestone's own brief names (`CLOSED_BETA_ENABLED`, `REAL_COMPANY_OUTREACH_ENABLED`,
  `PUBLIC_REGISTRATION_ENABLED`, `PRODUCTION_WEBHOOK_PROCESSING_ENABLED`) do not exist yet — real,
  additive work for Phase 26.

## 22. Admin operations

- Real admin controllers exist across billing/email/inbox-intelligence/recruitment-operations, all
  role-guarded (`@Roles(UserRole.ADMIN)`). No admin UI exists in the frontend for most of these — API
  only, matching this project's established "real backend surface, frontend catches up later"
  pattern. No admin bootstrap procedure — see §13.

## 23. Rate limiting

- See §2 — one flat global rule, no per-route tuning. Real Phase 8/18 gap for auth/OAuth endpoints
  specifically.

## 24. Error handling

- `AllExceptionsFilter` is real and consistently applied; error responses are structured
  (`TransformInterceptor`'s envelope). Not yet verified whether stack traces or internal error
  detail ever leak in a production `NODE_ENV` — needs explicit verification (Phase 18).

## 25. Existing documentation

- 12 milestone doc folders (M19/M23–M30), each with a real engineering report and, where the
  milestone warranted it, dedicated threat-model/known-limitations/safety-gates docs. This is a
  genuine, unusual strength for a project this size — every prior milestone's real findings and
  honest gaps are already recorded and cross-referenced. No consolidated top-level ADR log exists
  (ADRs live inside each relevant milestone's own doc folder) — this milestone's own ADR updates
  will follow the same established per-folder pattern.

---

## Production Readiness Matrix

| Area | Dev-only | Staging-ready | Production-ready | Needs real secrets | Needs real domain | Needs external provider approval | Needs Product Owner decision | Currently blocks Closed Beta |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Application code (domain/application layers, M20–M30) | | | ✅ | | | | | |
| Docker images | ✅ | | | | | | | ✅ (hardening needed) |
| CI pipeline | ✅ (scaffold-era) | | | | | | | ✅ |
| CD pipeline | — does not exist | | | | | | | ✅ |
| `/health` `/ready` `/live` | ✅ (fake) | | | | | | | ✅ |
| Structured logging/observability | — does not exist | | | | | | | ✅ |
| Alerting | — does not exist | | | | | | ✅ (vendor choice) | ✅ |
| Backup automation | — does not exist | | | | | | | ✅ |
| Restore drill evidence | — none yet | | | | | | | ✅ |
| Env-var startup validation | ✅ (missing) | | | | | | | ✅ |
| Secret management | ✅ (plain `.env`) | | | ✅ | | | ✅ (vendor choice) | ✅ |
| Hosting / cloud topology | — undecided | | | | | | ✅ | ✅ |
| Production domain(s) | — undecided | | | | ✅ | | ✅ | ✅ |
| TLS/HTTPS | — none yet | | | | ✅ | | | ✅ |
| Security headers / CORS hardening | ✅ (missing) | | | | | | | ✅ |
| Gmail OAuth (real) | — never tested | | | ✅ | ✅ | ✅ | ✅ | ✅ |
| Microsoft OAuth (real) | — never tested | | | ✅ | ✅ | ✅ | ✅ | ✅ |
| Real webhook receipt (all providers) | — never tested | | | | ✅ | ✅ | | ✅ |
| Paddle production | ✅ sandbox only | | | ✅ | | ✅ | ✅ | (deferred — not required for Closed Beta) |
| Database migrations discipline | | | ✅ | | | | | |
| Connection pool / timeout tuning | ✅ (defaults) | | | | | | | (tune before beta) |
| Closed beta access control | — does not exist | | | | | | | ✅ |
| Admin bootstrap procedure | — does not exist | | | | | | | ✅ |
| Beta onboarding flow | — does not exist | | | | | | | ✅ |
| Product telemetry | — does not exist | | | | | | | (needed before success-criteria measurement) |
| Emergency stop | — does not exist | | | | | | | ✅ |
| Rollback runbooks | — does not exist | | | | | | | ✅ |
| Privacy/Terms technical docs | — none yet | | | | | | ✅ (legal review) | ✅ |
| Security review | — not yet performed this milestone | | | | | | | ✅ |
| Load/reliability testing | — never performed | | | | | | | (needed before beta cohort sizing) |

**What blocks Closed Beta today, in priority order**: (1) no separate staging/production
environments or secrets exist — everything is the single local dev setup; (2) no hosting/domain has
been chosen (Product Owner decision, Phase 3/8); (3) real Google/Microsoft OAuth has never been
exercised against real accounts (Product Owner must provide test accounts/create the Cloud
projects, Phase 9/10); (4) no monitoring, alerting, backup, or emergency-stop mechanism exists;
(5) no closed-beta access control exists — the app has no concept of "invited user" today.

This matrix is the baseline every later phase in this milestone measures progress against.
