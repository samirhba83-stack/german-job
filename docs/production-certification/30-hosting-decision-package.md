# Milestone 31.1 Phase 3 — Hosting Decision Package

Proposals only — no purchase, no account creation, no provider selection made here. Sharper and
more concrete than doc 03's own architectural-shape analysis (which stopped at generic "Option
A/B/C" without naming real providers) — this document names real, current, practical providers
and compares them against this application's actual, real requirements. Prices are illustrative,
based on each provider's well-established public tier structure — **verify exact current pricing
directly on the provider's site at the moment of decision**, since tiers/pricing do shift over time
and this document is not a substitute for that final check.

## What German Job Engine actually needs (recap, from real code, not assumption)

- **API** (`apps/api`, `RUN_TICKS=false`) — a long-running Node process, public HTTPS.
- **Worker/Scheduler** — the SAME image, `RUN_TICKS=true`, exactly one instance (doc 03's own
  finding: no leader election exists yet for 4 of the 6 tick drivers) — must run continuously, not
  as a scheduled/serverless function (the shortest tick interval is 5 seconds).
- **Web** (`apps/web`, Next.js standalone) — a long-running Node process, public HTTPS.
- **PostgreSQL** — real, persistent, needs automated daily backups (Phase 13/doc 10).
- **S3-compatible object storage** — candidate documents (CVs, motivation letters).
- **Public HTTPS webhook endpoints** — Gmail Pub/Sub, Microsoft Graph, Paddle, email providers all
  need to reach this application over the public internet.
- **Environment isolation** — Staging and Production must be genuinely separate (doc 05).
- **Secrets** — injected as environment variables at container/process start (already the only
  mechanism this codebase reads secrets through — doc 05).

## Named provider comparison

| Provider | Monthly cost (Closed Beta scale) | Setup complexity | Postgres | Object storage | Worker support | Scheduler support | Private networking | Backups | Secrets | Deploy flow | Scaling | Lock-in | Ops complexity |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Railway** | ~$20–45 (usage-based, small services + Postgres) | Low — Docker-native, reads a Dockerfile directly, per-service env vars | Managed, one-click, automated backups on paid tier | No native S3 — pair with a separate bucket (e.g. Cloudflare R2, Backblaze B2) or self-host MinIO as a 4th service | Real — any service can run with no public port (a worker is just a service with `RUN_TICKS=true`) | Real — same as worker, always-on process, no cron/serverless mismatch | Real, automatic between services in the same project | Automated for its managed Postgres; object storage backup is the external provider's own job | Per-service env vars, referenceable across services | `git push` / GitHub-connected auto-deploy, or CLI | Vertical easy, horizontal manual | Low-medium — standard Docker images, portable | Low |
| **Render** | ~$25–55 (Web + Background Worker + Postgres tiers) | Low — native "Background Worker" service type, Blueprints (IaC-as-YAML) | Managed, automated daily backups on paid tier | No native S3 — pair with an external bucket | Real, first-class "Background Worker" service type (exactly this shape) | Real — same as worker; Render also has native Cron Jobs if ever wanted for something stateless | Real, private services communicate over an internal network | Automated for managed Postgres | Env var groups shareable across services | Git-connected auto-deploy, preview environments | Vertical easy, horizontal on paid tiers | Low-medium | Low |
| **Fly.io** | ~$15–40 (small Machines + Postgres) | Medium — `fly.toml` per app, more infra-aware than Railway/Render | Self-managed "Fly Postgres" (real Postgres, but you own backup scheduling) or an external managed Postgres | No native S3 — pair with Tigris (Fly's own S3-compatible offering) or external | Real — a Machine with no exposed port | Real — same | Real, Fly's own private network (6PN) between apps | Manual/scripted for Fly Postgres unless configured; Tigris has its own | `fly secrets set` per app | `fly deploy` from a Dockerfile | Real horizontal + geographic scaling if ever needed | Medium — `fly.toml`/Machines API is Fly-specific | Medium |
| **DigitalOcean App Platform + Managed DB + Spaces** | ~$40–80 (2–3 small services + managed Postgres + Spaces) | Low-medium — App Platform reads a Dockerfile; Spaces/Postgres are separate, well-documented add-ons | Managed, automated backups, point-in-time recovery on paid tiers | **Native S3-compatible (Spaces)** — closest drop-in for the existing `MinioStorageAdapter` (same S3 API) | Real — App Platform's "Worker" component type | Real — same as worker | Real, VPC between App Platform + managed DB + Droplets | Automated for managed Postgres; Spaces has its own versioning/lifecycle rules | Encrypted env vars per app/component | Git-connected auto-deploy | Vertical + horizontal, straightforward | Low-medium | Low-medium |
| **Hetzner Cloud (self-managed VPS + Docker Compose)** | ~$10–25 (1–2 small VMs) | High — you own the OS, Docker, TLS (Caddy/nginx), firewall, updates | Self-hosted in a container — you own backup scripting (`pg_dump` cron, already written this session — `scripts/backup-database.sh`) | Self-hosted MinIO (already the current dev setup) or pair with an external S3 bucket | Real — just another container | Real — just another container | Manual (same-host containers, or a private network add-on) | 100% self-scripted (real scripts already exist, doc 10) | `.env` file on the host, or a self-hosted secret store | Manual (`docker compose up -d`) or self-built CI/CD | Manual, requires provisioning a new VM | Lowest — plain Docker, maximally portable | **Highest** — every operational concern is yours |
| **AWS (ECS Fargate + RDS + S3)** | ~$60–150+ (Fargate tasks + small RDS + S3, before data transfer) | High — IAM, VPC, ECS task definitions, ALB, real AWS expertise needed | RDS — the industry-standard managed Postgres, automated backups, point-in-time recovery | **Native S3** — the reference implementation the "S3-compatible" adapter pattern was designed against | Real — an ECS service with no ALB target | Real — same, or genuinely a Fargate scheduled task if ever preferred | Real, full VPC control | Automated (RDS), highly configurable | AWS Secrets Manager or Parameter Store — a real, natural fit for this codebase's "inject as env vars" model | CI/CD via CodePipeline, GitHub Actions, or Terraform | Best-in-class horizontal scaling, if ever needed at real scale | **Highest** — most AWS-specific surface (IAM policies, task defs, VPC) | High |

## Recommendation

**For Closed Beta: Railway or Render.** Both are a direct, low-friction match for this
architecture's actual shape (a Dockerfile-based API + a Dockerfile-based Worker + a Dockerfile-based
Web + managed Postgres), both have genuinely first-class "long-running background process" support
(not a serverless/cron mismatch this app's 5-second tick interval would fight against), both keep
monthly cost in the same ~$20–55 range doc 03 already estimated for its own "Option B," and both
minimize new operational surface for a small, closely-monitored beta. Between the two: Render's
explicit "Background Worker" service type and native Cron Jobs concept map slightly more precisely
onto this app's own process-role vocabulary; Railway's UX is marginally simpler to get running
first. Either is a defensible choice — this is a coin-flip-close decision between two similar,
good options, not a case where one is clearly correct.

**Runner-up, if S3-compatible object storage parity matters more than deploy-flow simplicity:
DigitalOcean App Platform + Spaces** — Spaces is genuinely S3-API-compatible (same as the
already-built `MinioStorageAdapter` expects), so switching from local MinIO to Spaces is a pure
config change (endpoint + credentials), never a code change.

**For future Production growth** (beyond this milestone's own scope, documented for planning
only, matching doc 03's own "Option C" framing): **AWS (ECS Fargate + RDS + S3)** is the standard
destination once real scale, compliance requirements, or a need for fine-grained infrastructure
control justifies its meaningfully higher operational complexity and lock-in. Migrating from
Railway/Render to AWS later is a real, known, well-trodden path (the Docker images themselves are
already fully portable) — choosing Railway/Render now does not foreclose this.

**Not recommended for this milestone**: Hetzner (too much new operational burden for a team that
does not yet have a dedicated SRE function watching it) and AWS (too much setup complexity and
lock-in for a Closed Beta whose whole point is fast, safe, low-stakes validation).

---

## DECISION REQUIRED

**Decision:**
Hosting Provider for the real Staging (and eventually Production) environment.

**Why:**
11 of this milestone's 12 remaining blockers (doc 29) trace back to this one decision — no real
Staging environment, no real OAuth webhook receipt, no real monitoring destination, no real
backup/restore-on-Staging evidence, and no real Staging E2E run can proceed without a real, public,
HTTPS-reachable deployment target.

**Recommended option:**
Render or Railway (~$25–55/month for Closed Beta scale) — see comparison above.

**Alternative:**
DigitalOcean App Platform + Spaces (~$40–80/month) if native S3-API storage parity is preferred
over marginal deploy-flow simplicity.

**Expected cost:**
$20–80/month depending on the option chosen, at Closed Beta scale (a handful of small services + a
small managed Postgres instance). Scales up only if/when real usage justifies it.

**Security implications:**
None of these options change this codebase's own security posture — every one of them injects
secrets as environment variables (the only mechanism this codebase already reads secrets through),
and every one supports real HTTPS termination. The comparison table's "Lock-in" and "Ops
complexity" columns are the real differentiators, not security.

**What I need from Product Owner:**
Choose one option (or name a different provider not listed here), create the account, and provide
this session with either direct access or the specific values (API tokens/deploy hooks) needed to
provision the environment described in Phase 4 below.

**Work completed independently:**
This comparison, plus every piece of internal engineering preparation that does not require
knowing which provider was chosen (Phase 5's secret inventory/templates, Phase 2's real security
fix, Phase 17's test-recipient allowlist, Phase 20's fresh validation run) — see the rest of this
milestone's own report.

**Blocked next steps:**
Phase 4 (real Staging provisioning), and everything downstream of it (Phases 6–16, 18–19) per doc
29's blocker matrix.
