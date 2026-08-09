# Milestone 31 Engineering Report

## 1. What this milestone was

Not a feature milestone. Every prior milestone (M20–M30) built product capability; M31 asked a
different question of the exact same codebase: is this safe to hand to real, approved test users
in a Controlled Closed Beta, with real monitoring, real recovery, and real safety rails — and
where it is not yet safe, say so plainly rather than paper over the gap.

## 2. Real code shipped this milestone

**New modules**: `beta-access` (invitation-gated registration, admin cohort management, real-time
account suspension), `onboarding` (cross-context read-side status aggregator).

**New cross-cutting infrastructure**: `PreflightModule`-based fail-closed environment validation
(a minimal Nest context validates critical config *before* the real `AppModule` ever boots, so a
missing secret produces one clear itemized report instead of an opaque provider-constructor
crash); structured JSON logging wired through Nest's own `Logger.staticInstanceRef` delegation
(one `app.useLogger()` call, zero changes needed at any of the hundreds of existing `new
Logger(...)` call sites); request-ID/user-ID propagation via `AsyncLocalStorage`; real
`/health`/`/live`/`/ready` replacing an M11-era static stub; `/version`.

**New Production Safety Flags, genuinely wired** (not just declared):
`REAL_COMPANY_OUTREACH_ENABLED` (checked inside `ConnectedMailboxReadinessService`, the one real
gate every application-send call passes through) and `PRODUCTION_WEBHOOK_PROCESSING_ENABLED`
(checked inside `EmailWebhookProcessingService` and both inbox webhook controllers — every covered
webhook still authenticates and audits the caller, then acknowledges without acting, so no
provider ever sees a failure that would cause it to retry-storm or disable the subscription).

**Real Docker/CI hardening**: non-root containers, `pnpm prune --prod` (not a second `--prod`
install, which lacks the `prisma` CLI a Prisma-using package needs to regenerate its client),
`dumb-init`, real `HEALTHCHECK`s, Next.js `output: 'standalone'`, an 11-job CI pipeline, a staged
CD pipeline (deploy targets left as explicit `TODO(hosting decision)` rather than invented).

**Real backup/restore tooling**, executed against the real accumulated dev database, not just
written: exact row-count matches, FK validation, and ownership resolution on the restored copy.

## 3. Verification discipline actually followed

Every claim in this milestone's own 25 preceding documents was either (a) a real code change
verified by the standard checkpoint — `tsc --noEmit` → `eslint` → `nest build` → live boot — or
(b) a real, executed action against the running system (a curl sequence, a Playwright script, an
induced Postgres outage, a real Docker build), never an assertion of what "should" happen. The
full backend jest suite (197 suites / 1,295 tests) and frontend unit suite (26 tests) were re-run
clean at the end of this report, not just once mid-milestone.

## 4. Self-caught bugs (the discipline that matters most)

This milestone repeatedly found and fixed its own mistakes before calling anything done:

1. **A fail-closed validation ordering bug** — `EnvironmentValidationService` was originally
   called after `NestFactory.create(AppModule)`, too late to ever produce its own clear report
   (`JwtStrategy`'s constructor throws first). Fixed with the `PreflightModule` pattern; verified
   both the failure and success paths live.
2. **A wrong assumption about NestJS's logger internals** — first attempt overrode
   `formatMessage()` (receives pre-formatted, ANSI-wrapped text); caught by reading the actual
   compiled `@nestjs/common` source, corrected to override `printMessages()` instead.
3. **A real Docker build bug** (missing `apps/api/node_modules` copy — pnpm's isolated linker
   gives every workspace package its own symlink directory) — caught by actually running the built
   image, not just building it.
4. **A CORS/redirect regression** from changing `corsOrigin` to an array — introduced a dedicated
   `frontendUrl` config value rather than overloading CORS's own meaning.
5. **A flag that existed but did nothing** — `CLOSED_BETA_ENABLED` was defined and documented as
   the real Emergency Stop position for registration, but `RegisterHandler` never actually read it.
   Found while writing this milestone's own documentation (doc 16), not by a user report — fixed,
   tested (4 new unit cases), and live-verified across two full server restarts.
6. **4 regressed jest suites** from adding 3 new `UserRepository` methods and a new
   `RegisterHandler` constructor param — caught by this milestone's own full-suite checkpoint
   discipline, fixed in place (extended mocks, added real new coverage for the Emergency Stop
   case), re-confirmed clean.
7. **A would-have-shipped-broken frontend gap** — the register form had no invitation-code field
   at all; with the backend correctly requiring one, Closed Beta would have had *zero* working
   registration path through the real UI despite the API being fully correct. Found while auditing
   the flow end-to-end (not assumed correct because the backend was correct), fixed, and
   live-verified via a real Playwright submission through a real invitation code.
8. **A noisy-but-harmless false error state** — `useMyProfile()` treated a brand-new user's
   expected 404 ("no profile yet") as a query error rather than valid `null` data; found during a
   real browser console audit (Phase 22), fixed to match the domain repository's own "doesn't
   exist yet" semantics.
9. **A test-tooling bug caught by the Phase 29 E2E flow itself** — the flow's own campaign-creation
   payload was malformed; the *application* correctly rejected it with a real validation error.
   Investigated before assuming either "found a bug" or "just retry" — confirmed the real DTO shape
   from source, fixed the test, re-ran clean.

None of these were shipped silently fixed — each is documented in its own phase's report with the
real evidence, per this milestone's own "never hide a fixable failure" instruction.

## 5. Architectural decisions worth recording (see doc 27 for the formal entries)

- **API/Worker split via `RUN_TICKS`**, same Docker image, not two codebases — matches this
  system's actual architecture (interval-tick + Postgres-lock pattern, no external queue).
- **Suspension state kept out of the rich `User` domain aggregate**, via narrow dedicated
  repository methods — an administrative concern, not a domain-entity mutation, matching this
  codebase's own established pattern for similar concerns elsewhere.
- **Two independent flags for real company outreach** (`CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED`
  and `REAL_COMPANY_OUTREACH_ENABLED`) rather than one — an operator enabling general mailbox
  sending for an unrelated reason does not also silently arm real company contact.
- **`PRODUCTION_WEBHOOK_PROCESSING_ENABLED` deliberately excludes the Paddle billing webhook** —
  that surface already has its own dedicated, independently M27-certified safety gate; adding a
  second overlapping flag to a mature capability was assessed as added risk without added safety.
- **The onboarding status endpoint is a pure read-side aggregator**, mirroring
  `application-assembly`'s own established cross-context service shape — no new persistence, every
  field a live read of state another module already owns.

## 6. What this report does not claim

It does not claim real external validation of anything this milestone could not itself execute:
no real OAuth grant, no real webhook delivery, no real hosting deployment, no real user outside
this development environment. Doc 25 (RC1 Report) and doc 28 (Final Verdict) say this plainly.
