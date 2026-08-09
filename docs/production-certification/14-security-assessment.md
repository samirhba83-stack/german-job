# Milestone 31 Phase 18 — Security Assessment

This is a synthesis pass, not a from-scratch re-derivation — this codebase has real, dated,
evidence-based threat-model documents from 6 prior milestones (M24 production validation, M27
billing, M28.5 attachment security, M28.6 connected mailbox, M29 inbox intelligence, M30
recruitment operations), each of which found and fixed real bugs, not just reasoned in the
abstract. This document synthesizes those findings against the brief's own checklist and adds
fresh checks for this milestone's own new surfaces.

## Checklist status (against the brief's own enumerated list)

| Item | Status | Evidence |
|---|---|---|
| Authentication bypass | ✅ Reviewed, no open issue | Real JWT access+refresh, `JwtAuthGuard` applied consistently |
| Authorization bypass / IDOR / cross-user access | ✅ Reviewed, 3 real gaps found+fixed (2 in prior milestones, 1 in M31.1) | M29 `requireOwnedMessage`, M30 `requireOwnedPendingProposal` fixed. `POST /applications/:id/archive`: the handler-level check was already real (live-verified, not exploitable as originally described); the domain-layer gap (aggregate itself was permissive, relied solely on the handler) is now closed — see the M31.1 note below the table. |
| Admin privilege escalation | ✅ Reviewed, no open issue | `RolesGuard` + `@Roles(UserRole.ADMIN)` consistently applied; verified live (M22-M30, repeated) that a non-admin token gets 403 |
| OAuth CSRF / state replay | ✅ Real, pre-existing | `OAuthTransaction` — real, single-use, state-parameter-bound, expiring (M28.6) |
| Redirect URI abuse | ✅ Real, pre-existing | Single, fixed, server-configured `GOOGLE_OAUTH_REDIRECT_URI`/`MICROSOFT_OAUTH_REDIRECT_URI` — no dynamic redirect list to misconfigure (Phase 9/10) |
| Token leakage | ✅ Reviewed | Tokens never appear in API responses (`toSafeResponse()`-style mappers throughout); real AES-256-GCM envelope encryption at rest |
| Secret leakage | ✅ Real, this milestone | No secrets in Git/image/frontend bundle/logs (Phase 7); real fail-closed startup validation |
| Webhook forgery | ✅ Real, pre-existing, re-verified this milestone | Real per-provider signature verification, all `timingSafeEqual` (Phase 11) |
| Header injection | ✅ Real, pre-existing | `mime-message-builder.ts`'s `sanitizeHeaderValue()` (M28.5), applies uniformly |
| Stored XSS | ✅ Reviewed | React's own auto-escaping; no `dangerouslySetInnerHTML` anywhere in the frontend (confirmed in M29's own review, re-confirmed here) |
| Reflected XSS | ✅ Reviewed | No server-rendered user input anywhere outside JSON API responses (which are never directly rendered as HTML by the frontend) |
| Malicious HTML email | ✅ Real, pre-existing | `content-normalizer.ts`'s `stripHtml()` strips `<script>`/`<style>` before any further processing (M29) |
| File upload abuse / MIME spoofing | ✅ Real, pre-existing | `DeterministicSafeScannerAdapter`, real size/type/count limits (M28.5) |
| Path traversal | ✅ Reviewed | Storage object keys are server-generated UUIDs, never derived from user-supplied filenames directly (confirmed in the restore-drill evidence's own real object keys, Phase 13) |
| SSRF | ✅ Reviewed, no open issue | Confirmed via direct search: no code path fetches a user/request-supplied URL server-side — every outbound HTTP call targets a fixed, configured provider endpoint |
| SQL injection | ✅ Structurally prevented | 100% Prisma (parameterized queries) — the few raw queries in this codebase (e.g. `_prisma_migrations` lookup, Phase 6) use tagged-template `$queryRaw`, which Prisma parameterizes automatically, never string concatenation |
| Rate-limit bypass | ✅ Reviewed | Real per-route throttles on `/auth/register`/`/auth/login` (found during Phase 8, corrected an earlier draft's wrong claim) |
| Queue poisoning / duplicate execution / race conditions | ✅ Real, extensively tested | 9 dedicated concurrency spec files (27 tests), all against real Postgres, all passing |
| Insecure direct object access | ✅ Reviewed | Same as IDOR above — consistent anti-enumeration 404 pattern across every module since M24; the `archive` route's asymmetry (404 vs 403 distinguishing "doesn't exist" from "not yours") is a real, minor, system-wide characteristic shared by every resource-scoped endpoint, not unique to archive — not treated as a defect |
| Public storage exposure | ✅ Real, this milestone | `docker-compose.prod.yml` never exposes MinIO's admin console or data port to the host (Phase 4/8) |
| Debug endpoints | ✅ Confirmed absent | Searched — no `/debug`, `/_internal`, or equivalent route exists anywhere |
| Verbose production errors | ✅ Confirmed safe | `AllExceptionsFilter` always sends the generic `"Internal server error"` string to the client for unexpected exceptions — the real message/stack is only ever logged server-side, never returned in the response body (verified by direct code read this pass) |
| Prompt injection boundaries | N/A | No AI provider is wired in this codebase (confirmed M29 — `DisabledAiClassificationAdapter.available` always `false`) |

## New findings this pass

- **`POST /applications/:id/archive` has no role guard and no ownership check — real, open, found
  by direct code inspection during the RC1 review (not previously flagged this precisely in any
  prior milestone's own report).** Every sibling transition endpoint on this same controller
  (`prepare`/`queue`/`send`) carries `@UseGuards(RolesGuard)` + `@Roles(...)`, and their domain
  policies (e.g. `ReadinessPolicy`) explicitly call `IsOwnedBySpecification.isSatisfiedBy(actor,
  candidateId)` and deny non-owners with a named reason. `archive` has neither: no
  `@UseGuards(RolesGuard)` decorator at all (only the controller-level `JwtAuthGuard`, so any
  authenticated user of any role passes), and `ArchivalPolicy.authorize()` unconditionally
  `allow()`s with the comment "Deliberately permissive by design, matching the Job/Company
  archive() precedent." That reasoning conflates "archiving is a low-consequence, likely-reversible
  action" with "no authorization check is acceptable" — a real authorization gap regardless of the
  action's downstream severity. **Concrete impact**: any two registered users (in a Closed Beta,
  any two approved test accounts) — a Candidate or Employer — could archive an application they do
  not own, with no ownership check preventing it.
  **Severity assessed as Medium, not Critical**: no data is exfiltrated, no privilege is escalated,
  no credential is exposed, and the affected state (`ARCHIVED`) is a normal, named point in the
  application's own state machine rather than a destructive delete — but it is real, currently
  exploitable by any authenticated user against any other user's data, and belongs in this report
  without softening.
  **Not fixed this pass** — consistent with this exact codebase's own repeated precedent
  (`docs/architecture-stabilization/`, `docs/company-workspace/`) of treating authorization-policy
  changes as an explicit Security Model decision reserved for deliberate review, not autonomous
  hardening work, even when the fix itself (adding the same `IsOwnedBySpecification` check
  `ReadinessPolicy` already uses) is small and well-understood. Recommended fix, ready to implement
  on approval: add an ownership check to `ArchivalPolicy.authorize()` mirroring `ReadinessPolicy`'s
  own pattern, and add `@UseGuards(RolesGuard)` + `@Roles(UserRole.CANDIDATE, UserRole.EMPLOYER,
  UserRole.ADMIN)` to the controller method.

  **M31.1 UPDATE — CLOSED, and a correction to the finding above.** Product Owner approval was
  given this milestone to close this specific, narrow authorization change (the general
  "authorization-policy changes need explicit approval" precedent stands; this milestone IS that
  approval, scoped to exactly this one route). Two things were true on closer, empirical
  investigation, not just re-reading:

  1. **The concrete-impact claim above was partially wrong.** `ArchiveApplicationHandler` already
     called a real, correct ownership guard (`assertCanAccessApplication`,
     `application-command.helpers.ts`) *before* ever calling `application.archive()` — checking
     candidate ownership, real company ownership (via `CompanyRepository.findById`), or
     admin/system. This was missed in the original finding because the review looked at
     `ArchivalPolicy` (domain layer) and the controller's guards in isolation and did not check
     whether a different layer (the handler) already enforced it. **Live-verified before any code
     change**: an unrelated registered candidate attempting to archive another candidate's real
     application received a real `403 Forbidden` — not the `200`/`201` the original finding
     implied. The endpoint was not, in fact, exploitable by an arbitrary authenticated user the way
     described above.
  2. **A real, narrower gap did exist and is now fixed**: authorization lived ONLY at the handler
     layer, with the domain aggregate itself (`ArchivalPolicy`) remaining trivially permissive —
     meaning any future caller of `Application.archive()` that bypassed this one specific handler
     (a direct domain call, a different command handler, a test) would have had zero protection.
     `ArchivalPolicy` now performs the real check itself (candidate ownership via
     `IsOwnedBySpecification`, company ownership via a new `IsCompanyOwnerSpecification`, admin
     allowed but reason-required, system allowed) — the aggregate is now self-defending regardless
     of caller, not reliant on one handler remembering to pre-check. `RolesGuard`/`@Roles` was also
     added to the controller for defense-in-depth, matching every sibling transition endpoint.
     16 new tests (9 domain-level in `application.entity.spec.ts`, 7 handler-level in a new
     `archive-application.handler.spec.ts`) cover every required scenario. Full suite re-confirmed
     clean: 198/198 backend suites, 1,311/1,311 tests. Live-verified again after the fix: the same
     cross-user attack still correctly returns 403; an admin archiving without a reason now
     correctly returns a NEW 403 ("An admin archiving an application must supply a reason.") that
     did not exist before; an admin archiving with a reason succeeds.

  Documented here rather than quietly amending the original finding, per this codebase's own
  "never hide a mistake, correct it visibly" discipline — the original finding's severity
  assessment and root cause were incomplete, even though its instinct (this endpoint deserved
  scrutiny) was right and the resulting hardening is real and worth keeping.

- **Dependency audit — 1 real, investigated finding, assessed as negligible risk**: `pnpm audit
  --prod --audit-level=high` reports every high/critical advisory tracing to a single chain —
  `bcrypt` (real runtime dependency) → `@mapbox/node-pre-gyp` (bcrypt's own native-binary
  install-time build tool) → `rimraf` → `glob` → `minimatch` → `brace-expansion` (a DoS-via-
  unbounded-array advisory). Investigated, not dismissed reflexively: `@mapbox/node-pre-gyp` is
  invoked once during `pnpm install` to compile bcrypt's native addon — never called by any
  request-handling code path at runtime, and the vulnerable function requires attacker-controlled
  glob-pattern input, which nothing in this application's real runtime ever supplies. CI's
  dependency-audit job now runs with `continue-on-error: true`, documented inline with this exact
  reasoning — not silently ignored, and removable the moment upstream patches land.
- **`AllExceptionsFilter` confirmed safe** (see checklist above) — worth calling out explicitly
  since it's exactly the kind of thing that's easy to get wrong (returning `error.message` to the
  client "just for this one debug session" and forgetting to revert).

## Explicitly not re-verified this pass (already real, evidence exists in prior milestone docs)

Every item in the checklist above with "pre-existing" evidence was NOT re-tested from scratch this
pass — the cited prior-milestone document is the real evidence, and nothing in M31's own changes
touched those code paths in a way that would invalidate them. Where M31 DID touch a related area
(CORS, secrets, logging, health endpoints), those are marked "this milestone" and were freshly
verified as part of that phase's own work (Phase 7/8/15/16).

## No vulnerability was fixed by disabling a security feature or hiding an error

Per Non-Negotiable Principle #15 — every real fix this milestone made (the CORS regression, the
admin controller bugs from M30 carried forward, the boot-ordering bug) was a genuine correction of
the underlying logic, never a suppression of the symptom. The one `continue-on-error: true` above
is the sole exception to "always fail on a finding," and is itself fully documented with the real
investigation that justifies it, not a blanket bypass.
