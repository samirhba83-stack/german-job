# Milestone 31 Phase 20 — Closed Beta Access Model

Real, built, live-verified access-control layer restricting registration to explicitly-approved
users for the Controlled Closed Beta. Not a design proposal — every claim below was exercised
against the running local server with real HTTP requests (evidence in §5).

## 1. Design

Two independent, fail-closed flags (`apps/api/src/config/beta-access.config.ts`), both default
`false`:

| Flag | Default | Meaning when `false` |
|---|---|---|
| `PUBLIC_REGISTRATION_ENABLED` | `false` | No open self-service registration — this is Public Launch's flag, must stay `false` for the entire Controlled Closed Beta per the milestone's own explicit instruction. |
| `CLOSED_BETA_ENABLED` | `false` (kept `true` in the local `.env` for this milestone's own dev verification) | The real Emergency Stop position for registration as a whole — registration is refused outright, even for a holder of an otherwise-valid, unused, unexpired invitation. |

`RegisterHandler` (`apps/api/src/modules/auth/application/commands/register/register.handler.ts`)
evaluates them in order on every registration attempt:

1. `publicRegistrationEnabled=true` → skip straight to account creation (Public Launch state — not
   the state this milestone runs in).
2. `publicRegistrationEnabled=false`, `closedBetaEnabled=false` → `403 Forbidden`, "Registration is
   temporarily closed." No invitation code is even inspected. This is the real, immediate,
   no-deploy-required kill switch for Phase 27's Emergency Stop.
3. `publicRegistrationEnabled=false`, `closedBetaEnabled=true`, no `invitationCode` supplied →
   `403 Forbidden`, "An invitation is required to register during Closed Beta."
4. `publicRegistrationEnabled=false`, `closedBetaEnabled=true`, `invitationCode` supplied →
   `BetaInvitationService.checkEligible()` re-verifies in real time (email match, status, expiry)
   before the account is created; on success the account is created, then
   `BetaInvitationService.redeem()` atomically consumes the invitation.

Account creation happens strictly after eligibility is confirmed but strictly before consumption —
so a genuine two-request race on the same invitation can only ever let one request win the atomic
`tryConsume()` claim (`PrismaBetaInvitationRepository`, same conditional-update idiom as
`ApplicationTransitionProposalRepository.tryTransition()` from M30).

## 2. Data model

`BetaInvitation` (new Prisma model, migration
`20260806140000_m31_closed_beta_access`): `id`, `email`, `code` (cryptographically random,
`randomBytes(24).toString('base64url')`, never derived from the email), `status`
(`PENDING`/`USED`/`REVOKED`/`EXPIRED`), `invitedByAdminId`, `usedByUserId`, `usedAt`, `revokedAt`,
`revokedByAdminId`, `revokedReason`, `expiresAt` (default 14 days,
`BETA_INVITATION_EXPIRY_DAYS`), `createdAt`.

`User` gained 4 suspension columns (`accountSuspended`, `accountSuspendedReason`,
`accountSuspendedAt`, `accountSuspendedBy`) — deliberately *not* modeled as part of the rich `User`
domain aggregate. Suspension is an administrative side-channel operated through 3 narrow,
dedicated `UserRepository` methods (`getAccountStatus`/`suspend`/`unsuspend`) that talk to Prisma
directly, matching this codebase's own established pattern for narrow administrative repository
methods elsewhere (e.g. `ConnectedMailboxRepository`'s own non-aggregate operations). A freshly
created/saved `User` always maps to the neutral "not suspended" defaults
(`UserMapper.toPersistence()`); the existing suspension state of an already-persisted user is never
touched by an unrelated profile save.

## 3. Enforcement points

- **Registration gate** — `RegisterHandler`, described above.
- **Real-time suspension check** — `JwtStrategy.validate()` calls `getAccountStatus()` on *every*
  authenticated request, not only at login. This is a deliberate cost: without it, a JWT issued
  before a suspension stays valid until natural expiry (up to `JWT_ACCESS_EXPIRES_IN`), which would
  make Emergency Stop's "disable one user" action non-immediate. Verified live (§5) — an
  already-issued token is rejected within the same second an admin suspends the account.
- **Admin surface** — `AdminBetaAccessController` (`/admin/beta-access/*`), `RolesGuard`-gated to
  `UserRole.ADMIN`, same guard stack as every other admin controller in this codebase
  (`JwtAuthGuard` + `RolesGuard` + `@Roles(UserRole.ADMIN)`): invite, list/filter the cohort,
  revoke a pending invitation (reason required), suspend/unsuspend a user (reason required for
  suspend). Every invite/revoke/suspend/unsuspend action is recorded through
  `EmailSecurityAuditService` (`BETA_INVITATION_CREATED`, `BETA_INVITATION_REVOKED`,
  `BETA_INVITATION_REDEEMED`, `ACCOUNT_SUSPENDED`, `ACCOUNT_UNSUSPENDED`).

## 4. Known, honest gaps

- No admin UI for this surface yet — every action above is API-only, exercised via curl for this
  report. Phase 21/22 decide whether a minimal admin screen is in scope for RC1 or a documented
  post-beta follow-up (an authorized operator can drive the whole flow via `curl`/Postman in the
  interim, which is acceptable for a team-operated Closed Beta).
- `redeem()`'s failure path (a genuine race lost, or a last-moment revoke landing between
  `checkEligible()` and `redeem()`) leaves a real, usable account with an unconsumed invitation —
  documented in the handler's own comment as a deliberate, narrow, honest gap rather than a
  fabricated compensating rollback (building account deletion was explicitly deferred pending
  Phase 19's data-retention guidance, not invented here).
- No self-service "forgot my invitation" or resend flow — an admin must issue a fresh invitation.
  Acceptable for a small, team-operated Closed Beta cohort.

## 5. Live verification evidence

All of the following were executed against the real local server (not asserted), in this order,
including two full server restarts to prove the flag actually takes effect from the environment
(not just satisfies a unit test):

1. `POST /auth/register` with no invitation code, `CLOSED_BETA_ENABLED=true` → **403**, "An
   invitation is required to register during Closed Beta."
2. Admin login → `POST /admin/beta-access/invitations` → real invitation created, real random
   `code` returned.
3. `POST /auth/register` with that code → **201**, real access/refresh tokens issued.
4. Same code retried → **403** (already consumed — `status` no longer `PENDING`).
5. `.env` flipped to `CLOSED_BETA_ENABLED=false`, server restarted (fresh process, confirmed via a
   clean boot log with no stale listener) → a **freshly issued, still-`PENDING`, unexpired**
   invitation's code submitted to `POST /auth/register` → **403**, "Registration is temporarily
   closed." — the eligibility check is never even reached
   (`invitations.checkEligible` not called). This is the real Emergency Stop enforcement Phase 27
   depends on.
6. `.env` restored to `CLOSED_BETA_ENABLED=true`, server restarted again → a fresh invitation
   registers successfully (**201**) — confirms the flag is not a one-way trip and the steady-state
   Closed Beta flow still works after the Emergency Stop path was exercised.
7. (From earlier in this phase's own verification pass, unchanged by the fixes above): admin
   suspends an account that holds an already-issued, still-unexpired access token → the next
   request with that same token → **401**, "This account has been suspended." — confirms real-time
   enforcement, not merely "suspension prevents future logins."

## 6. Frontend gap caught and closed this phase

The register form (`apps/web/src/features/auth/components/register-form.tsx`) had no invitation-
code field at all — `RegisterRequestDto` didn't exist in `shared-types`, and `useAuth().register()`
only ever sent `{ email, password }`. With the backend correctly requiring an invitation code
whenever `CLOSED_BETA_ENABLED=true`, **every registration attempt through the real web UI would
have failed with 403** — the Closed Beta would have had no working onboarding path at all despite
the API being fully correct. Fixed: `RegisterRequestDto` added to `shared-types`, threaded through
`auth.api.ts`/`use-auth.ts`, and a real "Invitation code" field with honest closed-beta framing
added to the form. Live-verified with Playwright against the real running dev server (not asserted):
the field renders, a real end-to-end submission with a real admin-issued code redirects to the
shell root, and zero browser console errors either on page load or through the full submit flow.

## 7. Regression caught by this phase's own full-suite checkpoint

Adding `getAccountStatus`/`suspend`/`unsuspend` to the `UserRepository` interface and a new
constructor parameter to `RegisterHandler` broke 4 pre-existing jest suites that hand-built partial
mock objects (`CreateUserHandler`, `GetUserHandler`, `CandidateApplicationAssemblyService`,
`RegisterHandler` themselves). All 4 were fixed in place (mocks extended, `RegisterHandler`'s spec
rewritten with real coverage for all four gate outcomes, including the new Emergency Stop case).
Full suite re-confirmed clean: **196/196 suites, 1286/1286 tests.** Documented here rather than
silently fixed, per this milestone's own "never hide a fixable failure" instruction — this was a
real regression this phase introduced, not a pre-existing condition.
