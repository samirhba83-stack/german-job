# Milestone 31 Phase 3 — Cloud and Deployment Topology

Proposals only — no purchase, no provider selection, no account creation. Every option below is
presented for Product Owner decision. Process roles are separated in every option, closing Phase 1
§7's "everything in one process" finding.

## Required process roles (every topology)

| Process | Runs | Replica count (Closed Beta scale) |
|---|---|---|
| API | `apps/api` HTTP surface only — `node dist/main.js` with `RUN_TICKS=false` | 1–2 (safe to scale — no tick-driver services active) |
| Worker/Scheduler | The same `apps/api` image, `RUN_TICKS=true` — all 6 tick-driver services (§Phase 1 finding) | Exactly 1, always (no leader election exists yet — see Known Limitations) |
| Web | `apps/web` Next.js server | 1–2 |
| PostgreSQL | Managed or self-hosted | 1 (primary), backups per Phase 13 |
| Object storage | MinIO or S3-compatible | 1 |

`RUN_TICKS` is a new env var (Phase 26) — the same API image, started with `RUN_TICKS=true` on
exactly one instance, is what makes "Worker/Scheduler" a real, separate process role without
maintaining a second codebase. This directly satisfies Phase 3's "separate API/Worker/Scheduler
processes" requirement using this codebase's actual architecture (in-process tick drivers, not an
external queue — Phase 1 §6) rather than force-fitting infrastructure this app doesn't use.

## Option A — Minimum-cost topology

Single-region, single small VPS or PaaS, everything colocated. Suitable for Closed Beta's actual
scale (dozens, not thousands, of users).

- 1 VPS (e.g., 2 vCPU / 4GB RAM class) running: API container, Worker/Scheduler container, Web
  container, all via the existing `docker-compose.prod.yml` (needs real content — Phase 4) on one
  host.
- Managed Postgres (small tier) OR self-hosted Postgres on the same VPS with disciplined backups
  (Phase 13) — managed is strongly preferred even at minimum cost, since restore reliability matters
  more than the cost delta.
- Self-hosted MinIO on the same VPS, or a small managed S3-compatible bucket.
- Caddy or nginx as a lightweight reverse proxy/TLS terminator in front of both API and Web.
- **Estimated monthly cost**: $25–60 (VPS) + $15–25 (managed Postgres, small tier) + $0–10 (object
  storage, low volume) ≈ **$40–95/month**. Domain registration and TLS certificates (Let's Encrypt)
  are effectively free.
- **Trade-off**: single point of failure per role; acceptable for a small, monitored Closed Beta
  with a real Emergency Stop (Phase 27) and real backups (Phase 13), not acceptable at any larger
  scale.

## Option B — Recommended topology (this document's recommendation)

Single region, roles on separate small instances/services, still modest cost, meaningfully more
resilient than Option A without jumping to full container orchestration.

- API + Web as two separate small PaaS services (e.g., a container-hosting PaaS with per-service
  scaling) or two separate small VPS instances.
- Worker/Scheduler as its own single small instance/service (`RUN_TICKS=true`), isolated so a Web
  traffic spike never starves scheduled work, and so restarting Web/API never accidentally restarts
  the one process holding scheduling responsibility.
- Managed Postgres (small-to-medium tier, with automated daily backups — see Phase 13).
- Managed S3-compatible object storage (not self-hosted MinIO) — removes one more self-managed
  stateful service from the minimum topology.
- Managed TLS/CDN edge in front of Web and API.
- **Estimated monthly cost**: $15–30 (API) + $10–20 (Web) + $15–25 (Worker) + $20–35 (managed
  Postgres) + $5–15 (managed object storage) ≈ **$65–125/month**.

## Option C — Growth topology (not needed for Closed Beta; documented for planning only)

- Container orchestration (managed Kubernetes or equivalent) with real horizontal scaling for API
  and Web.
- **Before this topology is safe**: the leader-election gap on the 4 unprotected tick drivers
  (Phase 1 §7) must be closed first — a real Postgres-backed lock (the same `PostgresLeaseLock`
  primitive M26 already built for campaign execution) applied to the tick-registration layer itself,
  not just the per-item work each tick does.
- Multi-AZ managed Postgres with read replicas, if/when read load justifies it.
- CDN in front of Web at a real edge-cache tier.
- Real log aggregation and APM at a paid tier (Phase 15).
- **Estimated monthly cost**: $300–800+/month depending on scale, before enabling autoscaling
  headroom for traffic spikes — this range is illustrative only and should be re-estimated with real
  numbers once user growth data exists (Phase 23).

## Recommendation

**Option B for Closed Beta.** Option A is cheaper but concentrates every failure mode onto one host;
Option B's marginal cost (~$25–30/month more) buys real process isolation and lets the
Worker/Scheduler process keep running scheduled ticks even during an API/Web redeploy — directly
supporting Phase 27's Emergency Stop requirement ("pause workers" must be a real, independent
action, not "restart the one process that does everything").

**This is a recommendation, not a purchase.** Hosting provider, exact instance sizes, and final
domain remain open Product Owner decisions (see the AUTONOMY stop-list) — this document exists so
that decision can be made against real, itemized options rather than in the abstract.
