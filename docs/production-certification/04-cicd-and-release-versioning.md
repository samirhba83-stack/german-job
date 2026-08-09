# Milestone 31 Phase 4-6 — Container Hardening, CI/CD Pipeline, Release Versioning

## Phase 4 — Container hardening (real, live-verified)

Both `apps/api/Dockerfile` and `apps/web/Dockerfile` rewritten and **actually built and run** during
this milestone (not just written) — real bugs found and fixed in the process:

- Non-root `node` user in both images (verified: `docker exec ... whoami` → `node`).
- Real `HEALTHCHECK` (API: `/health`; Web: `/`).
- `dumb-init` as PID 1 for correct signal forwarding/zombie reaping.
- Minimal runtime images: API uses `pnpm prune --prod` on the already-built tree (not a fresh
  `--prod` reinstall — that failed, since `prisma generate` needs the `prisma` CLI, a
  devDependency, unavailable in a prod-only install); Web uses Next's `output: 'standalone'`.
- `RUN_TICKS` env var (default `true`) splits the API image into two real process roles without a
  second codebase — verified live: `RUN_TICKS=false` registers zero tick-driver services;
  `RUN_TICKS=true` registers all 6.
- 2 real bugs caught by actually building and running the images, not just reviewing the
  Dockerfile: (1) `pnpm install --prod` in a separate stage failed because `prisma generate`
  needs the CLI — fixed via `pnpm prune --prod` on the already-generated tree instead; (2) the
  runtime image never copied `apps/api/node_modules` (pnpm's isolated linker gives every
  workspace package its own symlink directory into the shared store) — every container crashed
  on boot with `Cannot find module 'reflect-metadata'` until fixed.
- `docker-compose.prod.yml` rewritten from a 15-line stub into a real production override:
  separate `api`/`worker`/`web` services (Worker gets `RUN_TICKS=true`, API gets `false`),
  Postgres/MinIO ports never exposed to the host.

## Phase 5 — CI/CD pipelines

`.github/workflows/ci.yml` rewritten from the scaffold-era lint/build/test-only pipeline into 11
real jobs: install, shared-types build, backend/frontend typecheck, backend/frontend lint,
dependency audit (`pnpm audit --audit-level=high`), unit tests, concurrency+integration tests
(real ephemeral Postgres service container), e2e tests (same, with the 2 known-limitation legacy
specs excluded by name so CI's signal stays meaningful), migration validation (`prisma migrate
deploy` + `prisma migrate diff --exit-code` for real schema-drift detection against a fresh
database), production build, and container build + Trivy vulnerability scan (high/critical fails
the job) for both images.

`.github/workflows/cd.yml` — the real deployment pipeline, structurally complete: build immutable,
commit-tagged images → deploy Staging (`environment: staging`) → staging verification → deploy
Production (`environment: production` — a real GitHub Environment, configured with required
reviewer approval once real infrastructure exists, which is what actually enforces "no automatic
Production deployment without human approval" at the platform level) → smoke test → monitoring
verification. **Every actual deploy step is a documented `TODO(hosting decision)` placeholder** —
there is nowhere to deploy to yet (Phase 3). Nothing in this file can deploy anywhere until that
decision is made; the pipeline exists so deployment becomes mechanical, not improvised, the moment
it is.

## Phase 6 — Release versioning

New `GET /version` (public, safe — deliberately excludes feature-flag state and deployment-actor
identity, which are operationally sensitive): `version` (from `package.json`), `gitCommit` and
`buildTimestamp` (build-time-injected via Docker `ARG`, wired end-to-end from `cd.yml`'s own git
commit through to the running container — verified live: a local build without the build args
correctly reports `"unknown"`, never a fabricated value), `environment`, and `migrationVersion`
(a real, live query against `_prisma_migrations` — verified live: correctly returned
`20260806090000_m30_recruitment_operations`, the actual latest applied migration in the running
database).

## Known limitation

The actual deploy/push/smoke-test/monitoring-verification steps in `cd.yml` are placeholders
pending the Phase 3 hosting decision and Phase 8 domain decision — both explicit Product Owner
decisions this milestone's AUTONOMY boundary does not permit making unilaterally. GitHub's
`environment: production` required-reviewer protection also needs to be configured in repository
Settings once a real deployment exists — this cannot be done from inside the repository itself.
