# Milestone 31.1 Phase 5 — Environment Secret Isolation, Rotation & Compromise Procedure

## 1. Real repository secret scan — result

Executed against the full git history (`git log --all -p`), not just the working tree:

- **Searched for**: high-entropy `key=`/`secret=`/`password=`/`token=` assignments, AWS-style
  access key ids (`AKIA...`), private key PEM headers (`BEGIN ... PRIVATE KEY`).
- **Result: 0 real secrets found.** Every match was an obvious test fixture (`'fake-webhook-secret-
  for-tests'`, `'test_webhook_secret_do_not_use_in_prod'`, `'fresh-access-token'` — all string
  literals inside `*.spec.ts` files, clearly synthetic).
- **`.env` was never committed** — confirmed via `git log --all --full-history -- .env` (empty
  result) and `git ls-files` (no tracked file matches `.env`/`.env.<name>` other than the
  `.example` templates, which contain only placeholders by design).
- Repository has 1 commit in its history as of this check, so this scan is exhaustive, not a
  sample.

**No compromised-secret response is triggered by this scan.** Nothing below in §3 needs to run as
a result of this check — it exists as the real, documented "what happens if" procedure for the
future, not because it was needed today.

## 2. Real, complete secret inventory (found by diffing every `process.env.X` reference in
`apps/api/src/config/*.ts` against `.env.example` — 30 real gaps found and closed this phase; see
the updated `.env.example`, plus new `.env.staging.example`/`.env.production.example`)

| Secret | Dev value | Staging | Production | Rotation impact if changed |
|---|---|---|---|---|
| `DATABASE_URL` | Local Docker Postgres | Real, separate managed instance | Real, separate managed instance | Coordinated deploy — every running process must pick up the new value simultaneously |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Obviously-fake dev placeholder | Unique, generated | Unique, generated, ≠ Staging's | **No graceful rotation window today** (doc 05's own known gap) — every existing access/refresh token signed with the old secret becomes invalid the instant the new one deploys; real users get logged out. A dual-key rotation window is real, scoped follow-up work, not built this pass |
| `MAILBOX_TOKEN_ENCRYPTION_KEY` | Empty (feature inert) | Unique, generated once | Unique, generated once, ≠ Staging's | **Cannot be rotated in place without a migration** — every already-encrypted OAuth token becomes unreadable the moment the key changes, since `tokenEncryptionVersion` supports reading multiple *historical* versions but writing a new version requires a real, scripted re-encryption pass (decrypt with old key, re-encrypt with new, while both keys are available) — not yet written; until then, "rotating" this key in an emergency means forcing every connected mailbox to reconnect (`force-reauthorization`, already a real admin endpoint, doc 22) |
| `GOOGLE_OAUTH_CLIENT_SECRET` / `MICROSOFT_OAUTH_CLIENT_SECRET` | Empty | Real, Staging-only app registration | Real, Production-only app registration | Rotate directly in the Google Cloud Console / Entra portal, update the secret manager, redeploy — no user-facing impact (client secret is never exposed to end users) |
| `PADDLE_API_KEY` / `PADDLE_WEBHOOK_SECRET` | Empty | Real sandbox credential | Real production credential | Rotate in the Paddle dashboard, update secret manager, redeploy |
| `RESEND_API_KEY` / provider equivalents | Empty | Real Staging test-mode credential | Real Production credential | Rotate at the provider, update secret manager, redeploy |
| `GOOGLE_INBOX_PUSH_AUTH_AUDIENCE` / `MICROSOFT_INBOX_WEBHOOK_CLIENT_STATE` | Empty | Real, random, generated | Real, random, generated, ≠ Staging's | Rotating requires updating both this application's config AND the provider-side subscription configuration simultaneously — a real, coordinated 2-sided change |
| `EMAIL_ATTACHMENT_STORAGE_ACCESS_KEY` / `..._SECRET_KEY` | Local MinIO defaults | Real Staging bucket credential | Real Production bucket credential | Rotate at the storage provider, update secret manager, redeploy |
| Admin bootstrap credential | N/A — no procedure exists yet (doc 01 §13's own still-real gap) | Same gap | Same gap | Not applicable until this gap is closed |

## 3. Compromised-secret procedure (real, ready to execute — not exercised this pass, since
nothing was found compromised)

1. **Identify scope**: which specific secret, which environment. Never assume "just this one" —
   check whether the same value was ever reused across environments (the whole point of doc 02's
   separation contract is that it shouldn't be, but verify).
2. **Revoke at the source first**: for a provider credential (OAuth client secret, API key), revoke
   or rotate it directly in that provider's own console — this is the step that actually stops
   further abuse, before anything in this application changes.
3. **Generate a new value**, following the same generation method already documented inline in
   `.env.staging.example`/`.env.production.example` (e.g. `randomBytes(32).toString('base64')` for
   symmetric keys).
4. **Update the secret manager** for the affected environment only — never touch the unaffected
   environment's value.
5. **Redeploy** the affected environment so the new value takes effect (§2's table shows which
   secrets need a coordinated/simultaneous redeploy vs. which tolerate a rolling one).
6. **Audit real impact**: for `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`, every existing session is
   now invalid (expected, not a bug). For `MAILBOX_TOKEN_ENCRYPTION_KEY`, every connected mailbox
   needs `force-reauthorization` (§2). For a provider API key, check that provider's own access
   logs for activity during the compromise window.
7. **Record the incident**: what secret, when discovered, when revoked, when rotated, real impact,
   root cause if known — this milestone does not build a dedicated incident-log table; use the
   existing `EmailSecurityAuditService` audit trail for anything that has a natural event type, and
   a plain written record (this doc's own future revision, or a real incident-tracking tool once
   chosen) for anything broader than a single auditable action.

## 4. What this phase does NOT claim

No secret manager vendor is chosen (Phase 7's own instruction: no paid vendor without approval) —
`.env.staging.example`/`.env.production.example` are the real, concrete reference for what to
populate once one is chosen; adopting one is a deployment-configuration change only, not a code
change (doc 05's own established conclusion, unchanged by this phase). No JWT dual-key rotation
window and no automated token re-encryption pass exist yet — both are real, honestly-named,
scoped follow-up work, not fabricated as already solved.
