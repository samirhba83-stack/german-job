# Milestone 31 Phase 2 — Environment Architecture

Three environments, each with fully independent state. This document is the contract every later
phase (Docker, CI/CD, secrets, OAuth) is built against. Domain names below use the placeholder
`<approved-domain>` — the real domain is a Product Owner decision (Phase 8) and is substituted
mechanically everywhere once chosen; nothing in this architecture depends on the specific string.

## The three environments

| | Development | Staging | Production |
|---|---|---|---|
| Purpose | Local iteration, this repo's own dev workflow | Pre-release verification, real OAuth/webhook certification, load testing | Controlled Closed Beta only — never public |
| Who has access | Engineers, local machine only | Project team + explicitly approved test accounts | Project team + admin-invited beta users only |
| Database | Local Docker Postgres (`german-job-engine-postgres-1`) | Independent managed/hosted Postgres instance | Independent managed/hosted Postgres instance |
| Object storage | Local Docker MinIO | Independent bucket/MinIO instance | Independent bucket/MinIO instance |
| OAuth apps (Google/Microsoft) | None (mocked in tests) | Real, dedicated Staging OAuth app registrations, real Test Users only | Real, dedicated Production OAuth app registrations, Closed Beta users only |
| Provider credentials (Resend/SES/SendGrid/SMTP, Paddle) | None / sandbox | Real sandbox/test credentials, own account or sub-account | Real credentials, separate from Staging's |
| Encryption keys (token vault, etc.) | Dev-only, low-stakes, committed to `.env.example` as obviously-fake placeholders only | Real, generated fresh for Staging, never reused | Real, generated fresh for Production, never reused, never equal to Staging's |
| Webhook URLs | None (local polling fallback only) | `webhooks-staging.<approved-domain>` | `webhooks.<approved-domain>` |
| Feature flags | All default (mostly `false`) | Staged per Phase 25's activation plan | Starts at Stage 0 (Phase 25), advances only on explicit approval |
| Logging destination | Console | Environment-tagged log aggregation (Phase 15) | Separate environment-tagged log aggregation, never mixed with Staging's logs |
| Environment variables | `.env` (gitignored, already established) | `.env.staging` equivalent, held in the chosen secret manager (Phase 7), never in Git | `.env.production` equivalent, held in the chosen secret manager, never in Git |

## The non-negotiable separations (from the brief, restated as enforceable contract)

Staging and Production must NEVER share:
- Database (different connection strings, different physical/managed instances)
- Storage bucket (different bucket names at minimum, ideally different accounts)
- OAuth secrets (separate Google Cloud OAuth client, separate Microsoft Entra app registration —
  not just separate redirect URIs on the same app)
- Paddle secrets (separate Paddle "environment" — sandbox for Staging, real for Production, per
  `PADDLE_ENVIRONMENT`, already a real config value from M27)
- Encryption keys (a Staging encryption-key compromise must never expose a Production token, and
  vice versa)
- Webhook secrets (`GOOGLE_INBOX_PUSH_AUTH_AUDIENCE`, `MICROSOFT_INBOX_WEBHOOK_CLIENT_STATE`, Paddle/
  Resend/SendGrid webhook signing secrets — every one, per environment)
- Admin credentials (the first Staging admin user and the first Production admin user are different
  accounts with different passwords)

## Environment identification at runtime

A new required env var, validated at boot (closes the Phase 1 §2/§7 "no startup validation" gap):

```
APP_ENVIRONMENT=development | staging | production
```

- Read once, at boot, by a new `EnvironmentValidationService` (Phase 7).
- Surfaced (non-sensitively) in the new `/version` endpoint (Phase 6) and attached to every
  structured log line (Phase 15) so a log or metric can never be misattributed to the wrong
  environment.
- `production` is the ONLY value that permits `NODE_ENV=production`-gated behavior (disabling
  Swagger, enabling HSTS, etc. — Phase 4/8) to activate; anything else fails safe to the more
  restrictive/verbose development behavior.

## What this phase does NOT do

Does not create the actual Staging/Production database instances, object storage accounts, OAuth
app registrations, or hosting accounts — those require the Product Owner decisions this document
exists to prepare for (hosting provider, domain, real Google Cloud/Microsoft Entra project
ownership — see Phase 3/8/9/10). This document is the contract those real resources will be
provisioned against once approved, so provisioning is mechanical rather than improvised.
