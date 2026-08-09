# Milestone 31.1 — Final Blocker Matrix & Verdict

## 1. Final Blocker Matrix (the brief's own required 15-item checklist)

| Item | Status | Real evidence |
|---|---|---|
| Application archive ownership | **PASS** | Domain-layer `ArchivalPolicy` now real (candidate/company/admin/system rules); live-verified before and after (attacker still 403, admin-without-reason now correctly 403, admin-with-reason 201); 16 new tests; full suite clean |
| Google OAuth real test | **BLOCKED_EXTERNAL** | Code re-verified complete (doc 32); real Google Cloud test project creation is a named AUTONOMY stop-condition |
| Google real webhook | **BLOCKED_EXTERNAL** | Same — requires the same Google Cloud project plus a real public Staging endpoint (also blocked, see Staging row) |
| Microsoft OAuth real test | **BLOCKED_EXTERNAL** | Code re-verified complete (doc 32); real Entra tenant/app creation is a named AUTONOMY stop-condition |
| Microsoft real webhook | **BLOCKED_EXTERNAL** | Same — plus a real public Staging endpoint |
| Staging environment | **BLOCKED_EXTERNAL** | Hosting decision package delivered (doc 30) with a clear recommendation; creating the account/provisioning is a named AUTONOMY stop-condition |
| Secret isolation | **PASS (templates + policy); BLOCKED_EXTERNAL (real values)** | 30 real missing vars found and documented; `.env.staging.example`/`.env.production.example` real templates; rotation runbook; clean repo secret scan (doc 31). Real Staging/Production secret VALUES cannot exist without Staging/Production existing |
| Monitoring | **PASS (abstraction); BLOCKED_EXTERNAL (a real destination)** | Real, live-verified `MetricsPort` + `ConsoleMetricsAdapter`, real instrumentation at 2 call sites, 19 tests closing a real pre-existing coverage gap (doc 33). Explicitly NOT claimed "operational" — no real dashboard/alert destination exists |
| Alert delivery | **BLOCKED_EXTERNAL** | Cannot be demonstrated without a real monitoring destination (Phase 12 depends on Phase 11's own still-open decision) |
| Backup restore | **PASS (against dev); BLOCKED_EXTERNAL (against Staging)** | A real drill already executed against the real accumulated dev database (doc 10, prior M31 session) — real row-count/FK/ownership evidence exists; re-running against Staging specifically requires Staging to exist |
| Emergency Stop | **PASS (against dev); BLOCKED_EXTERNAL (against Staging)** | 8 real, instant, live-verified admin controls (doc 22); re-verifying against a real deployed Staging environment requires Staging to exist |
| Closed Beta registration | **PASS** | Live-verified repeatedly this and the prior session: valid invite → 201; no invite → 403; reused invite → 403; revoked/expired → 403; Emergency Stop position → 403 even with a valid invite. The previously-found missing invitation-code UI bug (prior session) has its own regression evidence (a real Playwright submission through the real field) |
| Real Staging E2E | **BLOCKED_EXTERNAL** | A 21-step synthetic flow was run clean against the local dev server as an explicitly-labeled proxy (doc 24) — this milestone's own rules forbid calling that "Staging" |
| Critical security findings | **PASS — 0 open** | Doc 14, re-confirmed this phase |
| High security findings | **PASS — 0 open** | Doc 14, re-confirmed this phase; the one Medium finding (archive) is now closed (row 1) |

**Tally: 6 PASS, 2 partial (real internal work done, real external value blocked), 7 BLOCKED_EXTERNAL.**
Per the brief's own rule, any `BLOCKED_EXTERNAL` on a required certification condition prevents
approval — and 7 are required conditions.

## 2. What changed since Milestone 31's own verdict

Milestone 31 ended with 4 of 9 disqualifying conditions triggered and one real, misdiagnosed
security finding. This milestone (31.1):

- **Closed the one item that was genuinely closeable without external action** — the archive
  authorization gap — with a real fix, live verification, and an honest correction to the original
  finding's own overstated severity.
- **Closed a real, second-order gap the original finding's own remediation would have missed**:
  Stage 1 of the Staged Activation Plan (doc 21) described a "test recipients only" dry-run state
  that the code as written could not actually support — fixed with a real, tested allowlist
  mechanism (doc 34).
- **Found and closed 3 real, pre-existing test-coverage gaps** unrelated to any specific
  vulnerability — `EmailWebhookProcessingService` and both inbox webhook controllers had zero
  tests despite being the real intake for every non-billing webhook this application receives.
  19 new tests, including a real regression test for M29's own previously-fixed process-crash bug.
- **Built the real monitoring abstraction** (not just documentation) and live-verified it emits
  real metrics from the real running application — closing the gap between "a metrics catalogue
  is defined" (true since M31) and "the application actually calls a metrics API when something
  happens" (not true before this phase).
- **Produced 2 real, decision-ready DECISION REQUIRED packages** (hosting, monitoring) — sharper
  and more actionable than M31's own more abstract "Option A/B/C" proposals.
- **Did not close, and could not close**: anything requiring a real external account, a real
  domain, or a real hosting/monitoring vendor — exactly the items this milestone's own AUTONOMY
  clause forbids taking unilaterally.

## 3. Full validation, fresh this phase

- Shared-types typecheck: clean.
- Backend: typecheck clean, lint clean, `nest build` clean, **202/202 test suites, 1,333/1,333
  tests** (35 new tests this phase: 16 archive authorization, 3 webhook processing, 6 Gmail
  webhook, 5 Graph webhook, 3 email-queue-worker, 4 test-recipient allowlist — net of 2 pre-
  existing tests updated for the new `archive()` signature).
- Frontend: typecheck clean, lint clean, **26/26 unit tests** (unchanged — no frontend code
  touched this phase).
- **Real Docker rebuild and boot of the API image** — a genuinely fresh container, port-mapped,
  `/health` → 200, `/onboarding/status` unauthenticated → 401 (route present, guard enforced), the
  new `email_queue.claimed_batch_size` metric observed live inside the container's own logs.
  Web image not rebuilt this phase (no frontend changes) — last verified in the prior M31 session.

---

## FINAL VERDICT:
## MILESTONE 31.1 NOT READY

Not from inaction: this phase closed the one real, autonomously-closeable blocker (archive
authorization) plus 2 real second-order gaps found while closing it, and built genuine, live-
verified progress on 2 more (monitoring abstraction, test-recipient allowlist). But 7 of the
brief's own 15 required checklist items remain `BLOCKED_EXTERNAL`, and every one of them requires
an action only the Product Owner can take:

1. **Choose and provision a hosting provider** (doc 30's DECISION REQUIRED — recommendation:
   Render or Railway, ~$25-55/month).
2. **Create a real Google Cloud test project** and a **real Microsoft Entra app registration**
   (docs 07/08's own complete, ready-to-execute checklists).
3. **Choose a monitoring destination** (doc 33's DECISION REQUIRED — recommendation: Grafana
   Cloud free tier, or the hosting platform's own built-in view as an interim Stage 0 option).

Once any one of these lands, the corresponding blocked rows in §1 become executable immediately —
every piece of internal preparation those rows depend on is already real and already done.

**Do not start Milestone 32.** The next work is Product Owner action on one of the 3 items above,
in whichever order is practical — hosting first unlocks the most other rows (5 of 7 blocked items
depend on it directly or indirectly).
