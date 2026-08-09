# German Job Engine — Closed Beta RC1 Report

**Milestone**: 31 — Production Certification, Controlled Closed Beta Launch & Real-World Validation
**Report date**: 2026-08-08
**Scope certified**: Controlled Closed Beta only. Explicitly NOT Public Launch, NOT full feature
expansion, NOT real company outreach, NOT Milestone 32.

---

## 1. Purpose of this report

To state, plainly and with real evidence, whether German Job Engine is ready for a real, safe,
monitorable, recoverable Controlled Closed Beta — and to name, without softening, every condition
that is not yet met.

## 2. What was done this milestone (summary; full detail in docs 01–24)

30 phases were worked through in sequence. Every phase produced either a real, live-verified code
change, a real document grounded in the actual running system, or both. Highlights:

- **A complete, real Closed Beta access control system** (doc 16): invitation-gated registration,
  real-time account suspension, and a genuine Emergency Stop position for registration as a whole
  — every claim live-verified against the running server, including two full server restarts to
  prove flags actually take effect from the environment, not merely pass a unit test.
- **A real onboarding status API** (doc 17) reporting genuine per-step completion — including
  correctly distinguishing "not done yet" from "cannot be done in this environment" (the mailbox
  connection step, honestly `unavailable` rather than a misleading `incomplete`).
- **A real UX audit** (doc 18) with zero accessibility violations across 6 pages, zero unresolved
  console errors, and one real pre-existing gap surfaced honestly rather than hidden: the Profile
  screen itself is a stub — the backend is real and live, but no page exists to drive it yet.
- **Two new Production Safety Flags** (`REAL_COMPANY_OUTREACH_ENABLED`,
  `PRODUCTION_WEBHOOK_PROCESSING_ENABLED`) — not just declared, but genuinely wired into the real
  send/webhook code paths, unit-tested, and reconciled against a complete, freshly-grepped
  inventory of all 21 real flags in this codebase (doc 21).
- **A real Emergency Stop and Rollback capability assessment** (doc 22) — 8 real, instant admin
  controls confirmed to exist; 4 real gaps named plainly rather than assumed away.
- **Real load testing and a real induced failure** (doc 23) — a genuine Postgres outage was
  triggered against the live running process; `/health`/`/live` correctly stayed up, `/ready`
  correctly failed, and the process recovered automatically within seconds of Postgres coming
  back, with zero manual intervention beyond restarting the database container.
- **A full, 21-step synthetic E2E flow** (doc 24) run against the live server, catching and fixing
  a real defect in the test tooling itself along the way (not the application).
- **Along the way, this milestone found and fixed 4 regressions it introduced into itself**
  (stale test mocks after an interface change) and **one real, would-have-shipped-broken gap**
  (the frontend register form had no invitation-code field — Closed Beta would have had zero
  working registration path through the actual UI). Both were caught by this milestone's own
  checkpoint discipline, not left for a later pass.
- **The full validation suite was re-run clean at the end of this report**: shared-types
  typecheck, backend typecheck/lint/build, **197/197 backend test suites, 1,295/1,295 backend
  tests**, frontend typecheck/lint, **26/26 frontend unit tests**, plus the real Docker build of
  the web image (proving the one local build failure encountered — a Windows-only symlink
  permission limitation — does not exist in the real Linux production build path).

## 3. Non-Negotiable Principles — compliance check

| # | Principle | Status |
|---|---|---|
| 1 | Never enable all flags at once | ✅ Every flag defaults `false`; doc 21's Stage plan enables them one at a time |
| 2 | Never dev secrets in staging/prod | ✅ doc 05; no real staging/prod secrets exist yet (honestly, because no staging/prod environment exists yet either) |
| 3 | Never secrets in Git/frontend/logs | ✅ doc 05, doc 14; structured logger never logs CV/email/token content (doc 12) |
| 4 | Unit tests ≠ production proof | ✅ Every real capability this milestone built was also live-verified via real HTTP requests against a running server, not just unit-tested |
| 5 | Never assume OAuth/webhooks work before real testing | ✅ Explicitly never assumed — doc 07/08/09 marked "prepared, not executed" throughout, never upgraded to "certified" without real evidence |
| 6 | Never send to real companies during certification | ✅ Zero real sends occurred; `REAL_COMPANY_OUTREACH_ENABLED=false` throughout, and no real OAuth credentials exist to send through even if it were true |
| 7 | Never open public registration | ✅ `PUBLIC_REGISTRATION_ENABLED=false` throughout, live-verified |
| 8 | Never allow unapproved beta users | ✅ Every registration this milestone performed used a real, admin-issued invitation |
| 9 | Never destructive migration without approval | ✅ Every migration this milestone applied was additive only (confirmed by re-reading each migration file for doc 22) |
| 10 | Never release without rollback | ✅ doc 22 |
| 11 | Never rely on untested backup | ✅ doc 10 — a real restore drill was executed, not merely documented |
| 12 | Never expose before security review | ✅ doc 14 |
| 13 | Never log CV/email/token content | ✅ doc 12, doc 19 §1 |
| 14 | Never enable automatic reply/high-impact transitions/AI classification | ✅ `INBOX_AUTOMATIC_REPLY_ENABLED`, `AUTOMATIC_HIGH_IMPACT_TRANSITIONS_ENABLED`, `INBOX_AI_CLASSIFICATION_ENABLED` all `false` (doc 21) |
| 15 | All systems fail-closed | ✅ Every flag audited this milestone defaults to the restrictive state — confirmed by reading each config file's actual fallback, not assumed |
| 16 | Every production decision auditable/reversible | ✅ doc 22; every admin action this milestone built records a real `EmailSecurityAuditEvent` |

(Principles 17–20 concern real external accounts, legal review, and Product Owner approvals not
yet sought — addressed honestly in §5 below, not claimed as met.)

## 4. Deliverables status

All 24 production-certification documents (doc 01–24) are real and complete. This report is
deliverable 25. The Milestone 31 Engineering Report (doc 26) and updated decision records (doc 27)
follow this report. Every deliverable the brief named that required real, live code was built and
verified live, not merely documented — see §2.

## 5. Known Limitations (consolidated)

1. **No real Staging or Production environment exists.** Phase 3's hosting decision is genuinely
   blocked on Product Owner action (choosing/purchasing a hosting provider) — this milestone's own
   AUTONOMY boundary explicitly forbids proceeding past this without approval.
2. **No real Google Cloud OAuth project or Microsoft Entra tenant exists.** Phase 7/8/9/10 are
   real, complete checklists — genuinely prepared, never executed against a real external account,
   because creating one requires Product Owner action this milestone cannot take unilaterally.
3. **No real webhook has ever been received from a real provider.** Signature verification logic
   is real and unit-tested against the providers' own documented formats, but has never been
   exercised against a live, real notification.
4. **No separate Production secrets have been provisioned anywhere.** Every secret in this
   codebase today is a local development value.
5. **The Profile screen is a pre-existing UI stub** (doc 18 §5) — a beta candidate cannot create
   or edit their profile through the web UI today, only through the (real, live, already-verified)
   API directly.
6. **No live, restart-free Emergency Stop exists for the 6 background tick-driver services** (doc
   22 §4) — pausing them requires an env-var change and a process restart, not an instant API call.
7. **No "beta cohort" concept exists** for bulk-suspending a group of users at once (doc 22 §4).
8. **Admin account suspension does not explicitly revoke the user's refresh token** — low severity
   in practice (doc 22 §1's own explanation), but a real, named gap.
9. **No invitation email delivery** — an admin must manually relay the invitation code to the
   invitee today (doc 17 §3).
10. **No account/candidate data deletion workflow exists** — deliberately not built this pass,
    pending real legal/privacy review beyond this milestone's own technical scope (doc 11, doc 15).
11. ~~`POST /applications/:id/archive` has no role guard and no ownership check~~ — **CLOSED in
    Milestone 31.1**, with a correction: live testing showed the handler-level check was already
    real and the endpoint was not exploitable as originally described; the domain-layer gap (the
    aggregate relying solely on the handler, rather than being self-defending) was real and is now
    fixed, with `RolesGuard` added for defense-in-depth. See doc 14's M31.1 update and doc 29.

## 6. Residual Risks (consolidated)

| Risk | Likelihood | Impact | Mitigation in place |
|---|---|---|---|
| A real Google/Microsoft OAuth integration behaves differently than the prepared checklist assumes | Medium | Medium | Checklists are detailed and based on each provider's real documented contract; only real execution will fully retire this risk |
| A real webhook payload shape differs from what the signature verifiers/parsers expect | Medium | Low | `PRODUCTION_WEBHOOK_PROCESSING_ENABLED=false` means a shape mismatch would surface as a logged, harmless no-op, not a silent data-corrupting mutation |
| A beta tester is confused by the Profile screen being a stub | Medium | Low | `GET /onboarding/status` honestly reports this step as incomplete rather than hiding it; a real UI message could be added cheaply as a fast-follow |
| An operator mistakenly flips a production-safety flag without understanding its scope | Low | High | doc 21's matrix names every flag's exact real effect; doc 26 (Engineering Report) restates the two most critical ones prominently |
| The 6 tick-driver services cannot be paused without a restart during a real incident | Low | Medium | The restart itself is fast and well-understood (doc 22 §2); a live kill-switch is a named, scoped fast-follow |

## 7. Recommendation

Every gap named above is either (a) genuinely blocked on a Product Owner action this milestone's
own AUTONOMY clause correctly forbids taking unilaterally, or (b) a real, honestly-scoped
engineering gap that does not block Stage 0 (Closed Beta itself, per doc 21) but should be closed
before Stage 1 is approved. Nothing in this report was softened, hidden, or reframed as a "known
limitation" to avoid an uncomfortable verdict — see doc 30's Final Verdict for the explicit,
unambiguous statement this report's own evidence supports.
