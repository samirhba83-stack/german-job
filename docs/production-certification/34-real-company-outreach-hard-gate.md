# Milestone 31.1 Phase 17 — Real Company Outreach Hard Gate

## 1. Audit result: `REAL_COMPANY_OUTREACH_ENABLED` remains `false`

Confirmed via `.env`/`.env.example` (both `false`) and via `production-safety.config.ts`'s own
fail-closed default (`?? 'false'`). Real, live-verified this milestone (doc 14 M31.1 update) that
this flag is genuinely checked on the one authoritative send-readiness path
(`ConnectedMailboxReadinessService.checkReadiness()`).

## 2. A real gap this phase found and closed

Doc 21's own Staged Activation Plan describes Stage 1 as: "real connected mailboxes, test
recipients only... `REAL_COMPANY_OUTREACH_ENABLED` stays `false`." But the actual M31 implementation
made `realCompanyOutreachEnabled=false` block **every** send unconditionally — there was no way to
exercise "test recipients only" as a real, distinct state; Stage 1 as documented was not actually
buildable with the code as it stood before this phase.

**Fixed**: a new `TEST_RECIPIENT_ALLOWLIST` (comma-separated exact addresses and/or `@domain`
wildcards, empty/fail-closed by default) is now checked alongside `realCompanyOutreachEnabled`. A
send to an allowlisted address is permitted even while real company outreach stays disabled; a
send to anything else still requires the real, separate `REAL_COMPANY_OUTREACH_ENABLED=true`
approval. This makes Stage 1 genuinely exercisable for the first time, without weakening the
Stage 2 gate at all — a non-allowlisted recipient is exactly as blocked as before this change.

## 3. Blocking behavior — real, named, auditable

When a send is blocked for this reason, the blocking reason string is prefixed
`TEST_RECIPIENT_POLICY_BLOCKED:` — satisfying the brief's own "Record: TEST_RECIPIENT_POLICY_BLOCKED"
instruction as a real, greppable, auditable value (via the existing `CONNECTED_SEND_BLOCKED` audit
event's `detail` field — reusing the established audit event type rather than adding a new Prisma
enum value + migration for what is, at the data-model level, still "a send was blocked with this
specific reason," the same shape every other blocking reason already takes). No silent override
exists anywhere in this path — every reason in `blockingReasons` must be empty for `ready` to be
`true` (unchanged, pre-existing accumulation logic, doc 22).

## 4. Real test coverage (18 tests in the readiness service's own spec, 4 new this phase)

- Blocks a non-allowlisted recipient when real company outreach is disabled (updated to assert the
  new `TEST_RECIPIENT_POLICY_BLOCKED` prefix).
- Allows an exact-address allowlist match even with real company outreach disabled.
- Allows an `@domain` wildcard match even with real company outreach disabled.
- An empty allowlist approves nobody — fails closed, never silently permits everyone.

Full suite re-confirmed clean: 202/202 backend suites, 1,333/1,333 tests.

## 5. What this phase does not do

Does not populate `TEST_RECIPIENT_ALLOWLIST` with any real addresses — that's a real, Staging-time
decision (which specific test-recipient addresses are approved) the Product Owner makes once
Staging exists and real dry-run testing is scheduled, not something to invent placeholder values
for now.
