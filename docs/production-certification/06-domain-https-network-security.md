# Milestone 31 Phase 8 — Domain, HTTPS, and Network Security

## Real, live-verified this pass

- **CORS is now a real, tested allowlist** (was a single-origin string before): `CORS_ORIGIN` is a
  comma-separated list, Nest's CORS middleware enforces it natively. Verified live: a request with
  `Origin: http://localhost:3000` gets `Access-Control-Allow-Origin` echoed back; a request with
  `Origin: http://evil.example` gets no such header — the browser's own same-origin policy then
  blocks the response from ever being read by that origin's script.
- **Self-caught regression from the CORS change**: `MailboxOAuthCallbackController` used
  `app.corsOrigin` to build its post-OAuth browser redirect URL — broke the moment `corsOrigin`
  became an array. Fixed by introducing a dedicated `app.frontendUrl` (single value, defaults to
  the first CORS origin) — a real, previously-uncaught conflation between "who may call this API"
  and "where should a browser redirect land," now separated.
- **Security headers** (helmet, Phase 4/main.ts): `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN`, `X-DNS-Prefetch-Control: off` and helmet's other defaults —
  verified live via response headers. `Strict-Transport-Security` is set only when
  `APP_ENVIRONMENT=production` (HSTS only makes sense once real HTTPS is actually terminated in
  front of this API — setting it prematurely, before HTTPS exists, would be actively harmful).
- **Trusted proxy configuration**: not yet set (`app.set('trust proxy', ...)`) — needed once a
  real reverse proxy/load balancer sits in front of this API (Phase 3), so `req.ip`/rate-limiting
  correctly see the real client IP rather than the proxy's. Real, scoped follow-up once a topology
  is chosen — the exact trusted-proxy value depends on the specific proxy/CDN chosen.
- **File upload size limits**: already real, pre-existing (`MULTER_OUTER_SIZE_BOUND_BYTES`, M28.5)
  — not a gap.
- **JSON body size**: Express's own body-parser default (100kb) applies; not yet explicitly,
  deliberately configured to a documented value — a reasonable existing default, not an open gap,
  but worth an explicit choice once real request-shape data exists from Staging traffic.
- **Rate limiting**: `/auth/register` (5/min) and `/auth/login` (10/min) already carry real,
  stricter per-route throttles (found during this phase, corrected from an earlier draft of the
  Phase 1 audit — see that document's own correction note). `POST /mailbox-connections/:provider/
  start` has no additional throttle beyond the 100/min global default, but is authenticated
  (`JwtAuthGuard`) already, meaningfully narrowing its abuse surface — a real, lower-priority item,
  not added this pass.

## Database / storage exposure

`docker-compose.prod.yml` (Phase 4) never publishes Postgres or MinIO ports to the host —
confirmed by direct inspection: both services get `ports: []` in the production override,
reachable only via the internal Docker network by service name. This satisfies "Database not
publicly exposed" / "Storage admin port not publicly exposed" for the Option A/B topologies
(Phase 3); a managed database/storage service (Option B/C) would need the equivalent real firewall
rule configured at the provider level once chosen.

## What requires a Product Owner decision (not done this pass)

- **Final production domain(s)** — `app.<domain>`, `api.<domain>`, `webhooks.<domain>`. Nothing in
  this milestone hardcodes a domain anywhere; every reference uses `<approved-domain>` as an
  explicit placeholder (Phase 2). Choosing the real domain is a pure configuration exercise once
  decided — no code change required.
- **TLS certificates** — depends entirely on the hosting choice (Phase 3): a PaaS with managed TLS
  needs zero extra work; a raw VPS needs Let's Encrypt/Caddy configured as part of that topology's
  own setup, not yet built since no VPS exists to configure.
- **Trusted-proxy value, exact CDN/WAF choice** — depends on the hosting/CDN decision.

## Known limitation

Firewall rules and WAF-level protections (beyond application-level CORS/rate-limiting/helmet
headers, all of which are real and verified) require a real network/hosting environment to
configure — none exists yet. This document defines what MUST be true once one does; it does not
itself create that environment.
