# Milestone 31 Phase 7 — Secret Management

## What changed this milestone (real, live-verified)

Before M31: every secret was read via `process.env.X` with `undefined`/`''` as the silent
fallback (Phase 1 audit finding). The app booted successfully either way in every case, and
individual services mostly (correctly) failed closed AT POINT OF USE for feature-specific secrets
(the token vault refuses to encrypt without a key, `DomainReadinessService` reports
`UNCONFIGURED`) — but the two truly load-bearing secrets every environment needs
(`DATABASE_URL`, `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`) had no boot-time check at all.

`EnvironmentValidationService` (`shared/infrastructure/environment/`) now runs 8 real checks in a
lightweight, throwaway `PreflightModule` application context, **before** `NestFactory.create
(AppModule, ...)` is ever called — self-caught ordering bug: an earlier version ran the check
after `NestFactory.create()`, by which point `JwtStrategy`'s own constructor had already thrown a
raw, unhelpful error on a missing secret. Verified live, both paths:

- Missing `JWT_ACCESS_SECRET` → clear, itemized error, exit code 1, in under a second, never
  reaching the full app.
- Valid config → passes all 8 checks, full app boots, `/ready` re-runs the same rules (cheap,
  in-memory, no I/O) so a post-boot config regression still fails readiness.

The 8 checks: `APP_ENVIRONMENT` is a recognized value; `DATABASE_URL` set; `JWT_ACCESS_SECRET` set;
`JWT_REFRESH_SECRET` set; access/refresh secrets are distinct values; `MAILBOX_TOKEN_ENCRYPTION_KEY`
set if `CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED=true`; a real email provider credential
present if `EMAIL_PRODUCTION_SENDING_ENABLED=true`; Paddle credentials + `PADDLE_ENVIRONMENT=
production` present if `BILLING_PRODUCTION_PAYMENTS_ENABLED=true`.

## What every secret is, and where it lives per environment

| Secret | Purpose | Dev | Staging/Production |
|---|---|---|---|
| `DATABASE_URL` | Postgres connection | `.env` (gitignored, obviously-fake local password) | Secret manager (below), never `.env` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing | `.env` | Secret manager, unique per environment, never shared |
| `MAILBOX_TOKEN_ENCRYPTION_KEY` | AES-256-GCM envelope key for OAuth tokens | Empty (feature inert) | Secret manager, unique per environment |
| `GOOGLE_OAUTH_CLIENT_SECRET` / `MICROSOFT_OAUTH_CLIENT_SECRET` | OAuth app secrets | Empty | Secret manager, a SEPARATE OAuth app registration per environment (Phase 2) |
| `PADDLE_API_KEY` / `PADDLE_WEBHOOK_SECRET` | Billing | Empty (sandbox) | Secret manager; Production's are real Paddle production credentials, never the sandbox ones |
| `RESEND_API_KEY` / `AWS_SES_SECRET_ACCESS_KEY` / `SENDGRID_API_KEY` / `SMTP_PASSWORD` | Email delivery | Empty | Secret manager, whichever provider is chosen |
| `GOOGLE_INBOX_PUSH_AUTH_AUDIENCE` / `MICROSOFT_INBOX_WEBHOOK_CLIENT_STATE` | Webhook authenticity | Empty | Secret manager, unique per environment |
| `EMAIL_ATTACHMENT_STORAGE_ACCESS_KEY` / `..._SECRET_KEY` | Object storage | Local MinIO defaults | Secret manager |

## Requirements checklist (from the brief) and current status

- ✅ No secrets in Git — confirmed: `.env` is gitignored; `.env.example` contains only placeholder/
  empty values, never a real secret.
- ✅ No secrets in the Docker image — the production Dockerfiles (Phase 4) never `COPY` `.env`;
  secrets are injected at container-run time via environment variables only.
- ✅ No secrets in the frontend bundle — `apps/web` only ever reads `NEXT_PUBLIC_API_URL` (a URL,
  not a secret) at build time; no `NEXT_PUBLIC_*` secret exists anywhere in this codebase.
- ⚠️ No secrets in logs — not exhaustively audited this pass; the existing logging is Nest's plain
  `Logger` (Phase 15 finding: no structured logging exists yet), and no module was found
  deliberately logging a secret, but a real structured-logging pass (Phase 15) should include an
  explicit redaction rule as defense in depth, not rely solely on "no one currently logs one."
- ✅ Separate secrets per environment — enforced as a documented contract (Phase 2); nothing in
  code currently allows Staging and Production to accidentally share a value, since each
  environment's process only ever reads its own injected env vars.
- ⚠️ Rotation documentation — real for the token-encryption key specifically
  (`tokenEncryptionVersion` column supports reading multiple key versions, established since
  M28.6) but not yet written as an operator-facing runbook for every OTHER secret type (JWT, OAuth
  client secrets, Paddle keys) — real follow-up work, not done this pass.
- ✅ Startup validation — `EnvironmentValidationService`, described above, real and live-verified.
- ✅ Fail closed if required secrets are missing — same.
- ❌ Key versioning for JWT/OAuth secrets — not implemented; a JWT secret rotation today requires
  a coordinated deploy (all existing access tokens signed with the old secret become invalid the
  moment the new one is deployed) rather than a graceful dual-key rotation window. Real, scoped
  follow-up work for before a real rotation is ever needed.
- ❌ Emergency revocation procedure — not yet written as a runbook (relates to Phase 27's
  Emergency Stop, which does cover revoking a compromised connected-mailbox's OAuth grant, but not
  a compromised platform-level secret like `JWT_ACCESS_SECRET` itself).

## Secret manager selection — a real Product Owner decision, not made this pass

Per the brief's own instruction ("لا تختر Vendor مدفوعًا دون موافقة"), no paid secret-manager
vendor has been selected. What this milestone DOES establish: every secret is already isolated
behind `ConfigService.get('path.to.value')` reads — no code anywhere reads `process.env` directly
outside the `config/*.config.ts` files. This means adopting a real secret manager later (AWS
Secrets Manager, Google Secret Manager, HashiCorp Vault, or a hosting platform's own built-in
secret store) is a deployment-configuration change only — inject the resolved values as env vars
at container start, exactly as `.env` does locally — never a code change.
