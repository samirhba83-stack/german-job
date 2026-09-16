# Milestone 31.2 Phase 2/3 — Render Staging Topology & Infrastructure-as-Code

The real blueprint is [`render.yaml`](../../render.yaml) at the repo root (Render auto-detects this
file when a Blueprint deploy is initiated from the connected GitHub repo). This document is the
narrative: why each decision was made, and the exact external actions the blueprint depends on.

## 1. Services

| Service | Render type | Public? | Runs | Process command | Health check |
|---|---|---|---|---|---|
| `gje-staging-api` | Web Service | Yes | `apps/api` image, `RUN_TICKS=false` | `dumb-init -- node dist/main.js` (Dockerfile `ENTRYPOINT`/`CMD`, unchanged) | `GET /health` |
| `gje-staging-worker` | Background Worker | No | The SAME image, `RUN_TICKS=true` | Same | None (Render Background Workers are monitored by process liveness, not HTTP — this app still binds a port internally, just never receives external traffic) |
| `gje-staging-web` | Web Service | Yes | `apps/web` Next.js standalone image | `dumb-init -- node server.js` (unchanged) | `GET /` |
| `gje-staging-postgres` | Render Postgres (managed) | No (private only) | — | — | Render's own managed health monitoring |

**Why one dedicated Worker instance, not Render Cron Jobs**: re-confirmed directly from the real
code (doc 01 §7, unchanged) — this application's scheduled work is 6 real `setInterval`-driven
tick services (`EmailQueueWorkerService` 5s, `ExecutionTickDriverService` 30s,
`InboxPollingTickDriverService` 2m, `InboxWatchRenewalTickDriverService` 1h,
`RecruitmentOperationsTickDriverService` ×2 at 30m/15m) running inside one long-lived Nest
application context, not discrete, independently-invokable jobs. Render Cron Jobs spin up a fresh
container per scheduled run and tear it down after — fundamentally incompatible with a 5-second
interval (the container start/stop overhead alone would dominate), and would require rearchitecting
6 real, working, already-tested tick drivers into 6 separate stateless invocations for no real
benefit. A single dedicated Background Worker (`RUN_TICKS=true`, exactly one instance) is the
correct, minimal-risk translation of this application's real existing architecture onto Render —
not a workaround, the actual right answer.

**Single-execution guarantee, preserved**: `gje-staging-worker` must never be scaled beyond 1
instance — Render's Background Worker services do not autoscale by default (no HTTP traffic to
scale against), so this is the safe default, not something requiring extra configuration. Doc 01
§7's own real finding stands: 2 of 6 ticks (`ExecutionTickDriverService`, `EmailQueueWorkerService`)
are already safe under accidental multi-instance execution via real Postgres locks/conditional
claims; the other 4 are not yet — a second reason (beyond cost) to keep this at exactly 1 instance
until that gap is closed.

## 2. Private network relationships

- `gje-staging-api` and `gje-staging-worker` → `gje-staging-postgres`: Render's managed Postgres is
  reachable only via its internal connection string (`fromDatabase` in `render.yaml`) — never
  exposed publicly, matching doc 02's own "Staging and Production must never share a database, and
  neither should be publicly reachable" contract, extended here to mean "not publicly reachable at
  all," which is strictly safer.
- `gje-staging-web` → `gje-staging-api`: over the public internet via `NEXT_PUBLIC_API_URL`
  (Next.js's own client-side fetches need a real, public URL — there is no meaningful private-
  network shortcut for browser-originated requests). This is the correct, standard shape; Render's
  private networking benefits apply to service-to-service traffic (API ↔ Postgres), not
  browser-to-API traffic.
- Object storage (Cloudflare R2, external to Render) → `gje-staging-api`/`gje-staging-worker`: over
  the public internet via R2's own S3-compatible endpoint, authenticated by access key/secret —
  Render has no private-network path to a service outside Render, so this is the only option
  regardless of provider chosen.

## 3. Deployment dependencies (order matters)

1. `gje-staging-postgres` must exist before either `gje-staging-api`/`gje-staging-worker` can
   start (both read `DATABASE_URL` from it via `fromDatabase`).
2. The `ghcr.io` images (`.github/workflows/cd.yml`) must exist before any Render service can pull
   them — the very first real deploy needs at least one successful CD pipeline run first.
3. Prisma migrations must be applied to `gje-staging-postgres` before the API/Worker can serve
   real traffic (doc 40 — Database Certification — covers running `prisma migrate deploy` against
   the real Staging database).
4. `gje-staging-web` depends on `gje-staging-api`'s own public URL being known (for
   `NEXT_PUBLIC_API_URL`) — API should be created first, or the URL pattern
   (`https://gje-staging-api.onrender.com`) can be predicted from the service name Render assigns
   on creation (Render's own `.onrender.com` URLs are deterministic from the service name), which
   is what `render.yaml` already does.

## 4. Object storage — Cloudflare R2 (the concrete recommendation)

Doc 30's own hosting comparison already flagged that Render has no native managed object storage.
Cloudflare R2 is the concrete recommendation: real S3-API compatibility (zero code changes to
`MinioStorageAdapter`, only endpoint/credential env vars — confirmed by reading the adapter's own
implementation, which already targets the generic S3 API, not a MinIO-specific one), a real free
tier (10GB storage, **zero egress fees** — unlike AWS S3, which charges per-GB egress and would be
a real, ongoing cost surprise for a document-heavy application like this one), and no dependency
on Render itself (so it survives a future hosting-provider change unaffected).

## 5. EXTERNAL ACTION REQUIRED

**Provider:**
Render

**Purpose:**
Create the real Staging infrastructure this entire milestone depends on — 4 of this milestone's
remaining ~20 phases have no path forward without it.

**Exact Product Owner action:**
1. Create or log into a Render account at render.com.
2. Connect the GitHub account/repo `samirhba83-stack/german-job` (Render's own "Connect a
   repository" flow, GitHub OAuth — standard, no manual token handling).
3. From the Render dashboard, choose "New → Blueprint", point it at this repo's `render.yaml` at
   the root, branch `main`. Render will parse it and propose creating `gje-staging-postgres`,
   `gje-staging-api`, `gje-staging-worker`, `gje-staging-web` exactly as designed above.
4. Approve the Blueprint (this may involve approving a paid Starter-tier cost for Postgres +
   3 services — confirm the current Render pricing for these tiers before approving, since it is
   a real recurring cost, matching doc 30's own ~$25–55/month estimate for this shape).
5. Once services exist, generate their Deploy Hook URLs (each service's own Settings → Deploy
   Hook) and add them as GitHub Actions repository secrets: `RENDER_STAGING_DEPLOY_HOOK_API`,
   `RENDER_STAGING_DEPLOY_HOOK_WEB`, `RENDER_STAGING_DEPLOY_HOOK_WORKER` (repo Settings → Secrets
   and variables → Actions → New repository secret, environment: `staging`).
6. Add `STAGING_API_URL` (the real `gje-staging-api` public URL Render assigns) as the same kind
   of secret.
7. Set every `sync: false` value in `render.yaml` directly in the Render dashboard for each
   relevant service (JWT secrets, encryption key, storage credentials, OAuth credentials, Paddle/
   email-provider credentials) — doc 39 covers exactly which values to generate locally
   (safe to generate without any external account) versus which require a real vendor account
   first (Google/Microsoft/R2/Resend).

**Data or value Claude needs afterward:**
The real Staging URLs (`gje-staging-api`/`gje-staging-web`'s `.onrender.com` addresses, or a real
custom domain if one is later chosen) — non-sensitive, safe to share directly.

**What NOT to share:**
Render account password, Render API keys, Deploy Hook URLs themselves (treat as secrets — anyone
with a Deploy Hook URL can trigger a deploy), any of the `sync: false` values once set.

**Independent work already completed:**
The real `render.yaml` blueprint, the real CD pipeline (registry push + deploy-hook trigger,
already wired and waiting for the secrets above), the `RENDER_GIT_COMMIT` fallback fix, and this
document's own full topology design — nothing further can be prepared without the account existing.

**Next automatic step after completion:**
Once the 4 GitHub Actions secrets above exist, the very next push to `main` (or a manual
`workflow_dispatch`) will automatically build, push, and deploy to the real Staging environment —
no further manual trigger needed. I will then run doc 40's real database certification and doc 41's
real security re-certification against the live URL.

## 6. Cost model & Free-tier limitations

Real, current figures — fetched directly from Render's own docs/pricing pages (not estimated from
stale general knowledge), current as of this pass. Verify against the real Blueprint preview before
approving any charge; Render's own numbers there are always the final, authoritative source.

| Resource | Plan ID | Legacy name | Monthly cost | Why this plan |
|---|---|---|---|---|
| `gje-staging-worker` | `0.5c-512mb` | `starter` (used in `render.yaml`) | ~$7/mo | **Required, non-negotiable** — Render has zero free instance type for Background Workers at all. This is the one resource that always requires payment info on file, regardless of how the other three are configured. |
| `gje-staging-postgres` | `0.1c-256mb` | `basic-256mb` | ~$6/mo compute + $0.30/GB/mo storage (`diskSizeGB: 1` set explicitly → ~$0.30/mo) | Lowest-cost real PAID Postgres plan. Chosen over Free to avoid Free Postgres's confirmed 30-day expiration + 14-day grace period (44 days total before the database, and all its data, is permanently deleted) — staging data must persist through this certification's own real timeline. |
| `gje-staging-api` | `free` | — | $0/mo | Per explicit Product Owner direction — accepting the real risk described below. |
| `gje-staging-web` | `free` | — | $0/mo | Pure frontend, no webhook/background responsibility — spin-down only costs a human tester a ~1-minute cold start. |

**Estimated total: ~$13.30/month.**

### A real, previously-latent bug this pass fixed

`gje-staging-postgres` previously carried `plan: starter`. Unlike Web Services/Workers (where
`starter` is a genuine, still-supported legacy alias for `0.5c-512mb`), Postgres never had `starter`
as a legacy name under Render's current plan system — it only ever existed as one of Postgres's old,
separate, now-defunct "legacy instance types" (Starter/Standard/Pro/Pro Plus), which Render's own
docs state explicitly "are not available for new databases." This Blueprint would very likely have
failed real validation, or been silently coerced to an unintended default, the first time it was
actually applied — independent of any cost decision. Fixed to the real, current `0.1c-256mb` plan ID.

### The real, accepted risk: `gje-staging-api` on Free

Render's own documentation confirms a Free Web Service spins down after 15 minutes with no inbound
traffic and takes "about one minute" to wake on the next request. Render explicitly documents a
browser-facing "loading page" during that wake window — but does **not** document what happens to a
non-browser caller, such as a webhook POST from Google Cloud Pub/Sub, Microsoft Graph, or Paddle,
arriving at a spun-down instance. This is a real, confirmed gap in Render's own docs, not a hidden
detail. Independent (non-Render-authoritative) analysis suggests the practical risk: many webhook
senders use 10–30 second delivery timeouts, shorter than Render's ~60-second wake window, so the
first webhook delivery after any 15-minute idle gap has a real chance of being marked failed by the
sender before the API instance finishes waking. Whether that delivery is ultimately lost then depends
entirely on the specific sender's own retry policy (Pub/Sub, Graph, and Paddle each have their own —
not evaluated here).

**Concrete verification procedure, to run for real once `gje-staging-api` exists** (this is what
makes the risk above "testable," not just theoretical):
1. Let the service sit idle for at least 16 minutes (past the 15-minute spin-down threshold) —
   confirm via Render's dashboard that it shows as spun down/idle.
2. Send a single real `curl -w '%{time_total}\n' https://gje-staging-api.onrender.com/health` and
   record the actual response time and status code — this measures the real cold-start latency for
   this specific deployment, not just Render's general "~1 minute" figure.
3. Repeat step 1, then trigger one real webhook delivery per configured provider once their real
   credentials exist (a real Gmail Pub/Sub push, a real Microsoft Graph subscription renewal
   notification, a real Paddle sandbox webhook) — record whether the provider's own dashboard/logs
   show the delivery as succeeded, retried, or failed, and cross-reference against this API's own
   structured logs for that request.
4. If any provider's webhook is confirmed lost (not just delayed) during a cold start, that is the
   trigger to upgrade `gje-staging-api` specifically to `starter` (a single-line `render.yaml` plan
   change, no other architecture change) — not a reason to abandon the free-tier attempt outright,
   since steps 1–3 may well show the real risk is smaller in practice than the worst case above.
