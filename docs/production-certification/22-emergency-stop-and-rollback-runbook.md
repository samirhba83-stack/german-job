# Milestone 31 Phase 27 — Emergency Stop & Rollback Runbook

Every control below was verified to exist by reading the actual controller/service, not assumed
from the milestone brief's own wishlist — the brief names 12 specific stop capabilities; this
report says plainly, for each one, REAL-AND-INSTANT, REAL-BUT-REQUIRES-RESTART, or GAP.

## 1. Per-capability status

| Capability | Status | Real mechanism |
|---|---|---|
| Disable one user | **Real, instant** | `POST /admin/beta-access/users/:userId/suspend` — `JwtStrategy.validate()` checks suspension on every authenticated request, so an already-issued access token is rejected on its very next use (Phase 20 §5, live-verified) |
| Revoke a pending invitation | **Real, instant** | `POST /admin/beta-access/invitations/:id/revoke` |
| Disable one campaign | **Real, instant** | `POST /campaigns/:id/pause`, `POST /campaigns/:id/cancel` (M25) |
| Disable one mailbox | **Real, instant** | `PATCH /admin/connected-mailboxes/:id/suspend`, `.../disconnect` (M28.6) |
| Force mailbox reauthorization | **Real, instant** | `PATCH /admin/connected-mailboxes/:id/force-reauthorization` |
| Disable a provider | **Real, instant** | `POST /admin/email/providers/:providerId/disable` (M28) |
| Disable a sender identity | **Real, instant** | `POST /admin/email/sender-identities/:id/suspend` (M28.5) |
| Suspend an inbox connection specifically | **Real, instant** | `PATCH /admin/inbox-intelligence/mailboxes/:id/suspend` (M29) |
| Stop all real company outreach | **Real, instant-ish** | `REAL_COMPANY_OUTREACH_ENABLED=false` — already the default; flipping it live requires a process restart (see §2), but every connected-mailbox send already passes through this exact check (Phase 26, this milestone) |
| Stop inbound webhook processing | **Real, instant-ish** | `PRODUCTION_WEBHOOK_PROCESSING_ENABLED=false` — same restart caveat as above (Phase 26, this milestone) |
| Stop reply-driven execution | **Real, instant-ish** | `REPLY_DRIVEN_EXECUTION_ENABLED=false` — already the default; same restart caveat |
| Block new OAuth connections | **Partial / GAP** | No dedicated flag exists — the closest real lever is `CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED`/OAuth client credentials being unset (which already makes connection impossible in every environment today, per Phase 21's onboarding-status finding) or removing the OAuth client credentials at the secret-store level; there is no single admin action that blocks *only new* connections while leaving existing ones untouched |
| Pause workers / scheduler globally | **GAP (requires restart)** | Each of the 6 tick-driver services checks its own config flag once at `onModuleInit()` — there is no live, DB-backed, API-triggered pause that takes effect without a process restart. The restart itself is fast (a single env var change, no code change, no migration — see §2), but it is not "instant" in the sense of a same-request effect the way user suspension is |
| Disable one beta cohort | **GAP** | No "cohort" concept exists in the data model — only individual invitations and individual users. A bulk action (e.g. "suspend everyone invited by admin X" or "suspend everyone who registered this week") would need a new query, not just a new endpoint; not built this phase |
| Revoke compromised credentials | **Partial** | `RefreshTokenRepository.revoke(userId)` exists and is real (used by logout) — but it is not wired into the admin suspend endpoint, so suspending a user does not explicitly revoke their refresh token. In practice this is low-severity: any access token minted from that refresh token still fails immediately on first use (the same real-time `JwtStrategy` check), so a suspended user cannot successfully call any protected endpoint regardless — but a `POST /auth/refresh` call would still return a (useless) 200 rather than a 401. Documented here rather than silently left unmentioned; a real, small fast-follow (see §4) |

## 2. Why "requires restart" is still fast, not "no control"

Every flag in doc 21's matrix is read once from `process.env` at process boot (`ConfigModule`).
Changing one means: update the env var → restart the process. For the containerized topology
(doc 03), that is a single `docker compose up -d --force-recreate api worker` (or the equivalent
managed-platform env-var-and-redeploy action) — no code change, no database migration, no build
step beyond what's already built. This is meaningfully different from "there is no way to stop
this" — it is "stopping this takes one restart cycle, not one request."

## 3. Rollback Runbooks

For each release surface, the real, concrete rollback action:

| Surface | Rollback action |
|---|---|
| Backend/frontend release (bad code) | Redeploy the previous known-good image tag (doc 04's release-versioning policy tags every build with `GIT_COMMIT`) — `docker compose up -d --force-recreate` with the prior tag |
| Worker release | Same as above, applied to the Worker service specifically (independent from the API per the `RUN_TICKS` process split, doc 03) |
| DB migration | Every migration this milestone applied was additive (new tables/columns, no drops, no renames — confirmed by re-reading each migration file). A genuinely additive migration's rollback is "stop using the new columns," which is exactly what setting the relevant feature flag back to `false` already achieves — no destructive down-migration was needed or written. A future non-additive migration would need its own real down-migration, written and tested before that migration ships, not assumed |
| Feature flag activation | Flip the flag back to its default in `.env` / the deployment's secret store, restart (§2) |
| OAuth config | Rotate/revoke the affected client secret in the Google Cloud Console / Entra portal directly (outside this codebase); `MAILBOX_TOKEN_ENCRYPTION_KEY` rotation is a separate, real, harder operation (every already-encrypted token becomes unreadable) — not attempted casually; existing connections would need to be force-reauthorized (`force-reauthorization` endpoints above) after a key rotation |
| Webhook activation | `PRODUCTION_WEBHOOK_PROCESSING_ENABLED=false` (§1) — the provider keeps sending notifications, they are just acknowledged and not acted on, so no provider-side unsubscribe is needed to roll back |

## 4. Real gaps this phase surfaced (not fixed, honestly listed)

1. **No live, restart-free global pause for the 6 tick-driver services.** A real, scoped
   fast-follow: a single DB-backed `OperationalKillSwitch` row each tick driver checks at the
   start of every tick (not just at boot) would close this — deliberately not built this phase
   given the size of touching all 6 services correctly under this milestone's own time
   constraints; flagged rather than rushed.
2. **No "beta cohort" bulk-action.** Would need a real query concept (e.g. "everyone invited in
   the last N days") before a bulk-suspend endpoint makes sense — a product decision as much as an
   engineering one.
3. **Admin suspend does not explicitly call `RefreshTokenRepository.revoke()`.** Low severity
   (§1's own explanation of why), a real one-line fast-follow.
4. **No dedicated "block new OAuth connections only" flag.** The practical equivalent (unset
   OAuth credentials) already applies today in every environment (Phase 21 finding), so this gap
   has zero real-world exposure right now — but it would need a real, purpose-built flag before
   Stage 1 of doc 21's activation plan is entered.

None of these four gaps block Closed Beta itself (Stage 0 of doc 21) — they matter starting at
Stage 1, and should be closed before that stage is approved, not before RC1.
