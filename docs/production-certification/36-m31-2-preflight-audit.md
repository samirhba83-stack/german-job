# Milestone 31.2 Phase 1 — Pre-Flight Audit

Reconciled against docs 30 (hosting), 31 (secrets), 32 (OAuth/webhook readiness), 33 (monitoring),
34 (outreach hard gate), 35 (M31.1 final matrix) — re-confirmed against the actual current code
(not re-copied from those docs' own prose) before any deployment work began.

## Current code state, re-confirmed this phase

- Backend: 202/202 test suites, 1,333/1,333 tests, clean typecheck/lint/build (unchanged since
  doc 35 — no application code has changed except the two fixes made this phase, below).
- Frontend: 26/26 tests, clean typecheck/lint (unchanged).
- Docker: API image builds and boots correctly (re-confirmed doc 35's own evidence still holds).
- Git remote: `https://github.com/samirhba83-stack/german-job` — a real repo exists, giving
  doc 30/36's own registry-image design something concrete to target (`ghcr.io/samirhba83-stack/...`).
- 2 real fixes made this phase (both closed, not left as findings):
  1. `release.config.ts` now falls back to Render's own automatically-provided
     `RENDER_GIT_COMMIT` env var when `GIT_COMMIT` isn't explicitly set — closes the real "do not
     leave gitCommit=unknown in the certified RC" risk for a deploy that doesn't go through the
     full CD pipeline's own explicit build-arg.
  2. `.github/workflows/cd.yml` — the `build-and-push` job now genuinely pushes to GitHub
     Container Registry (`ghcr.io`, using the automatically-available `GITHUB_TOKEN` — no new
     external account needed) instead of `push: false`, and `deploy-staging` now triggers real
     Render Deploy Hooks (once they exist — see doc 37's own EXTERNAL ACTION REQUIRED). This
     directly answers Phase 2's own "should the app build on Render or deploy a pre-built image"
     question: Render's Docker-from-source builds have no clean, documented way to pass custom
     `--build-arg` values through `render.yaml`, so deploying a pre-built, CI-produced image (which
     already carries the real commit/timestamp baked in) is the correct choice — not a Render
     limitation to work around blindly, but the more correct CI/CD pattern regardless of platform.

## A/B/C/D Checklist

### A. Ready internally (no further engineering work needed before Staging exists)

- Docker images (API, Web) — real, hardened, build and boot correctly.
- CI pipeline (`ci.yml`) — real, 11 jobs, already running on every push.
- CD pipeline (`cd.yml`) — real registry push + deploy-hook trigger logic, now complete (this
  phase's own fix).
- Environment/secret architecture — real 3-environment contract (doc 02), real templates
  (`.env.staging.example`/`.env.production.example`, doc 31), real startup validation
  (`EnvironmentValidationService`).
- Closed Beta access control, Emergency Stop, production safety flags, test-recipient allowlist,
  archive authorization — all real, live-verified against local dev, all with real test coverage.
- Monitoring abstraction (`MetricsPort`) — real, live-verified emitting real metrics; needs only a
  real adapter binding once a vendor account exists.
- `/health`, `/ready`, `/live`, `/version` — real, all already tested against real failure
  scenarios (doc 23's real Postgres-outage drill).

### B. Requires external account action (cannot proceed without Product Owner)

- Render account + the 3 Staging services (API, Worker, Web) + Staging Postgres — doc 37's own
  EXTERNAL ACTION REQUIRED.
- `RENDER_STAGING_DEPLOY_HOOK_API`/`_WEB`/`_WORKER` and `STAGING_API_URL` GitHub Actions secrets —
  cannot be created before the Render services above exist.
- Google Cloud test project (Gmail API, OAuth consent, Pub/Sub) — doc 38's own EXTERNAL ACTION
  REQUIRED.
- Microsoft Entra test app registration — doc 38's own EXTERNAL ACTION REQUIRED.
- Grafana Cloud account (or confirmed use of Render's own built-in metrics as the Stage 0
  interim) — doc 39's own EXTERNAL ACTION REQUIRED.
- Object storage for Staging — a real S3-compatible bucket (Render does not offer managed object
  storage directly; the recommendation, consistent with doc 30's own comparison, is Cloudflare R2
  or Backblaze B2 — both S3-API-compatible, so `MinioStorageAdapter` needs zero code changes,
  only new endpoint/credential env vars).

### C. Requires real Staging verification (cannot be done until B is resolved)

Everything in the brief's Phases 9–24: real Gmail/Outlook OAuth, real webhook receipt, real
alert delivery, real Staging backup/restore, real deployment/rollback drill, security
re-certification against a real deployed target, the real browser Closed Beta flow, and the full
Google/Microsoft E2E scenarios. None of these can be started, let alone passed, before B exists —
consistent with the brief's own repeated instruction that a locally-simulated version of any of
these does not count.

### D. Failed and needs engineering correction

None found this phase beyond the 2 real fixes already listed under "Current code state" above
(both already closed, not left open). No regression, no new defect.

## What this phase does not do

Does not create any Render, Google Cloud, Microsoft Entra, or Grafana Cloud resource — every one
of those is a real account-creation action reserved for the Product Owner, per this milestone's
own explicit AUTONOMY boundary. See doc 37 (Render), doc 38 (Google/Microsoft), doc 39
(monitoring) for the exact, precise action each one needs.
