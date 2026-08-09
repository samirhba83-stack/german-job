# Milestone 31 Phase 29 — Full Staging E2E Certification

**Honest scoping note, stated up front, per this milestone's own disqualifying-conditions list:**
no real Staging environment exists — Phase 3's hosting decision is still pending Product Owner
action, and stands as one of this certification's genuine, named blockers (see doc 25's Final
Verdict). What follows is the closest honest substitute available without that infrastructure: a
full, real, synthetic, multi-step flow executed against the live local dev server (real Postgres,
real MinIO, real HTTP requests — nothing mocked), run twice for reproducibility (once caught a
real test-script defect, fixed and re-run clean — see §3). This is a dev-environment proxy for
Staging E2E, not a replacement for it — RC1's verdict treats it as such.

## 1. What was run

A single, real, sequential script drove the actual API surface end-to-end, reusing no cached
state from earlier phases (a fresh candidate account, fresh invitations, fresh campaign, all
created fresh within the run):

1. `GET /health` → 200
2. `GET /live` → 200
3. `GET /ready` → 200 (real DB round trip)
4. Admin login → real JWT issued
5. Admin creates a real, email-bound invitation
6. Registration attempt with no invitation code → **403** (Closed Beta gate holds)
7. Registration with the valid invitation code → **201**, real tokens issued
8. Same invitation code reused → **403** (exactly-once consumption holds)
9. Fresh candidate login → 200
10. `GET /onboarding/status` before any profile exists → `profile` step correctly `incomplete`
11. `POST /profiles` → real profile row created
12. `GET /onboarding/status` again → real `profileCompletionPercentage` reflects the just-created
    (still-empty) profile
13. `POST /campaigns` with a full, valid nested payload (goal/strategy/batchPlan/executionWindow)
    → **201**, real campaign created
14. `GET /onboarding/status` again → `campaign` step now correctly `complete`
15. `GET /campaigns` → 200, the new campaign appears
16. `GET /billing/plans` → 200 (sandbox-mode Paddle plans)
17. Admin suspends the candidate account, reason recorded
18. The candidate's still-valid access token, used again → **401**, "This account has been
    suspended." — real-time enforcement confirmed once more, this time inside a full multi-step
    flow rather than an isolated check
19. Admin unsuspends the account
20. Fresh candidate login → 200 — access restored
21. Admin revokes a separate pending invitation → 200

**21/21 real checks passed** on the clean, reproducible run.

## 2. What this flow deliberately proves together, not just individually

Every one of these 21 steps was already individually verified in isolation across Phases 20/21
(this milestone's own earlier work). What Phase 29 adds is running them **as one continuous,
stateful sequence** — the same kind of flow a real Closed Beta tester would actually perform in
order, sharing state (the same candidate account, the same tokens, the same campaign) across
steps, rather than each check starting from a clean slate. This is a materially different, stronger
kind of evidence than isolated unit/integration tests provide, and is exactly what a real Staging
E2E suite is for.

## 3. A real defect this phase caught in its own test tooling (not the application)

The first run of this exact flow failed at step 13 (`Create campaign`) with a real `400`:
`"nested property strategy must be either object or array"`. Investigation confirmed this was the
E2E script's own payload being wrong, not an application defect —
`CreateCampaignDto` legitimately requires a full nested shape (`goal`, `strategy`, `batchPlan`,
`executionWindow`), and correctly rejected the malformed simplified payload the script first sent.
This is itself a valid, positive finding (`class-validator` input validation is real and working,
not merely declared) — logged here rather than silently corrected and hidden, per this milestone's
own "never hide a fixable failure" instruction. The script was fixed to send a real, valid payload
(matching the DTO's own actual shape, read directly from source, not guessed) and the full 21-step
flow was re-run clean.

## 4. What Phase 29 does not cover, and why

- **Real Google/Microsoft OAuth flows** — cannot be run without real credentials (Phase 9/10,
  genuinely blocked on Product Owner action).
- **Real webhook delivery from Gmail/Graph/Paddle/email providers** — same reason; Phase 9/10/11
  are prepared, not executable, without real external accounts.
- **The actual browser UI walking this same flow end-to-end** — Phase 22 already did this
  separately (13 authenticated routes, real login, zero console errors, zero accessibility
  violations) using a different real beta test account; not re-run here to avoid duplicating
  already-real evidence. Between Phase 22 (UI) and this phase (API), every step of the real user
  journey through Stage 0 of doc 21's activation plan has now been walked at least once, for real,
  against a real backend.
- **Multi-day/long-running flows** (invitation expiry after 14 real days, follow-up suppression
  windows) — not practically runnable in a single session; these are already covered by this
  codebase's own unit-level tests using a fake/controllable clock (`ExecutionClock`), which is the
  honest, established way this codebase tests time-dependent behavior without waiting real days.
