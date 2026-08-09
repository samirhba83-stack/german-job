# Milestone 31.2 Phase 6/15 — Staging Secret Provisioning & Monitoring External Action

## Part 1 — Phase 6: Staging secret provisioning

Per this milestone's own explicit rule, no secret VALUE appears anywhere in this document, in any
terminal output, or in any report — only which values need generating, by whom, and where they go.

### Values the Product Owner should generate themselves, locally (Claude never sees or holds these)

Run each command below on your own machine (not shared with Claude), and paste the result
directly into the corresponding Render environment variable field (dashboard → service →
Environment) — never into this chat, never into a committed file:

| Render env var | Generation command | Used for |
|---|---|---|
| `JWT_ACCESS_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` | Access token signing |
| `JWT_REFRESH_SECRET` | Same command, run again (a second, distinct value) | Refresh token signing |
| `MAILBOX_TOKEN_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` | AES-256-GCM OAuth token encryption |
| `GOOGLE_INBOX_PUSH_AUTH_AUDIENCE` | `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"` | Verifying real Gmail Pub/Sub push requests (also set as the Pub/Sub push subscription's own auth token, doc 38) |
| `MICROSOFT_INBOX_WEBHOOK_CLIENT_STATE` | Same command, run again (a distinct value) | Verifying real Microsoft Graph notifications |

Each of these is a pure local computation — no vendor account needed to generate them, and doing
so on your own machine (rather than asking Claude to compute and display them) means the real
value never appears anywhere in this conversation's history, matching the brief's own "never
print secret values" rule as strictly as possible.

### Values that require a vendor account first (covered in their own EXTERNAL ACTION REQUIRED blocks)

- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` / `GOOGLE_INBOX_PUBSUB_TOPIC` — doc 38.
- `MICROSOFT_OAUTH_CLIENT_ID` / `MICROSOFT_OAUTH_CLIENT_SECRET` — doc 38.
- `EMAIL_ATTACHMENT_STORAGE_ENDPOINT` / `_ACCESS_KEY` / `_SECRET_KEY` — Cloudflare R2 account
  (create a bucket named `gje-staging-candidate-documents`, generate an S3 API token scoped to
  that bucket only — R2 dashboard → Manage R2 API Tokens).
- `PADDLE_API_KEY` / `PADDLE_WEBHOOK_SECRET` — the existing Paddle sandbox account from M27 (no new
  account needed if one already exists; otherwise a free Paddle sandbox signup).
- `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET` — a Resend account (free tier covers Closed Beta scale
  for transactional/system mail — candidate application email itself sends via the connected
  mailbox, not Resend, per M28.6's own design).
- `TEST_RECIPIENT_ALLOWLIST` — not generated, but decided: the real, specific email addresses
  approved to receive Staging test sends (the Test User accounts from doc 38, at minimum).

### Repository secret scan — to be re-run after provisioning

Doc 31's own real, clean secret scan (`git log --all -p` searched for high-entropy assignments,
AWS-style keys, private-key headers) should be re-run once all the above are set, to confirm none
were accidentally committed during provisioning — a 30-second check
(`git log --all -p | grep -iE "(api[_-]?key|secret|password|token)\s*[:=]\s*['\"]?[A-Za-z0-9+/=_-]{16,}"`)
that costs nothing to repeat and catches a real, common mistake (pasting a secret into a commit
message or a debug log line by accident).

---

## Part 2 — Phase 15: EXTERNAL ACTION REQUIRED — MONITORING

**Provider:**
Grafana Cloud

**Purpose:**
Give the real, already-built `MetricsPort` abstraction (doc 33) a real destination — today it only
emits structured log lines via `ConsoleMetricsAdapter`, which this milestone's own rule correctly
refuses to call "operational monitoring."

**Exact Product Owner action:**
1. Create a free Grafana Cloud account at grafana.com (the free tier covers Closed Beta scale: 10k
   metrics series, 50GB logs, real alerting — no payment method required for this tier as of
   Grafana's current published pricing; verify this hasn't changed before proceeding).
2. From the Grafana Cloud stack's own "Connections → Add new connection" page, note the stack's
   OTLP (OpenTelemetry Protocol) gateway endpoint URL and generate an API token scoped to metrics
   write access.

**Data or value Claude needs afterward:**
The OTLP endpoint URL (not sensitive) — the API token itself is set directly as a Render secret
(`GRAFANA_CLOUD_OTLP_TOKEN`, new env var this integration will need), never shared in chat.

**What NOT to share:**
The API token.

**Independent work already completed / the real, honest implementation plan:**
`MetricsPort`'s DI seam (doc 33) already makes swapping the bound adapter a one-line change in
`ObservabilityModule`. The real adapter for Grafana Cloud will use the official
`@opentelemetry/exporter-metrics-otlp-http` package (a real, maintained, independently-tested
OpenTelemetry SDK package) rather than hand-rolling Prometheus remote-write's binary wire protocol
from scratch — a real engineering judgment call: implementing that protocol correctly without a
live endpoint to test against risks shipping unverified, silently-wrong code, which this
milestone's own discipline (and this whole project's established "never declare something done
without real verification") both rule out. **This adapter is deliberately not written yet** — it is
real, scoped, low-risk follow-up work once a real Grafana Cloud stack exists to test the actual
wire traffic against, not a gap glossed over as already handled.

`ConsoleMetricsAdapter` stays bound as the default (unchanged, still real, still available for
local development) until the Grafana adapter is built and verified.

**Next automatic step after completion:**
Build `GrafanaCloudMetricsAdapter` using the OTel exporter package, bind it in `ObservabilityModule`
behind a config flag (`METRICS_DESTINATION=console|grafana`, defaulting to `console` — fail-safe,
matching every other flag in this codebase), instrument the full doc 13/19 metrics catalogue
(today only 3 of ~35 metrics are wired — doc 33 §2's own honest accounting), then execute Phase 16
(real dashboards) and Phase 17 (real alert delivery, doc 44) against the live stack.
