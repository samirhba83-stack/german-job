# Milestone 31 Phase 24 — Closed Beta Success Criteria

Measurable, not aspirational — every number below is computable from doc 19's real telemetry
catalogue, and every criterion is scoped to what a small, team-operated Controlled Closed Beta
should actually prove, not to growth or revenue (explicitly out of scope per the milestone brief:
this is validation, not Public Launch).

## 1. Technical success criteria

| Criterion | Target | Source |
|---|---|---|
| API availability during the beta window | ≥ 99% of external `/health` polls succeed | doc 12 Observability |
| No untriaged Critical/High security finding open | 0 | doc 14 Security Assessment, re-checked at RC1 |
| Zero data loss incidents | 0 | Backup/restore drill (doc 10), incident log |
| Zero incidents where a real email reached a non-approved recipient | 0 | Doc 19 §4 trust signals; enforced by `CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED`/`REAL_COMPANY_OUTREACH_ENABLED` staying `false` throughout |
| Emergency Stop, when exercised (drill or real), takes effect within 1 request cycle | Confirmed | Phase 20 §5 already demonstrates this for registration/suspension; Phase 27 extends it to sends/workers |
| No jest suite regression introduced by this milestone's own changes | 0 failing suites | This session's own repeated full-suite checkpoints (197/197, 1294/1294 as of Phase 22) |

## 2. Product/UX success criteria

| Criterion | Target | Source |
|---|---|---|
| A test beta user can go from invitation to a created campaign without engineering intervention | Yes/No, walked end-to-end | Phase 21 onboarding status + Phase 29 staging E2E |
| Zero WCAG 2A/2AA violations on the core authenticated flows | 0 | Phase 22 (already achieved: 0/6 pages checked) |
| Zero unresolved browser console errors on the core authenticated flows | 0 | Phase 22 (already achieved after the `useMyProfile` fix) |
| Every "not yet built" surface tells the user why, not a blank page or silent failure | 100% of known stubs | `NotYetAvailable` component usage audit (already the established pattern per M20 frontend architecture) |

## 3. Business/process success criteria

These are about proving the *process* works safely, since real company outreach and public
registration are both explicitly out of scope for this beta:

| Criterion | Target | Source |
|---|---|---|
| Every beta participant is on the explicit approved list (invitation-gated) | 100% | Phase 20 (`CLOSED_BETA_ENABLED=true`, `PUBLIC_REGISTRATION_ENABLED=false` for the entire beta) |
| Zero real companies contacted | 0 | Doc 19 §4 |
| At least one full real restore drill completed before RC1 | 1 | doc 10 (already done this milestone) |
| At least one Emergency Stop drill completed before RC1 | 1 | Phase 27 (pending) |
| A written, itemized list of what real user feedback would unblock for a future milestone | Delivered | Phase 30 RC1 report |

## 4. What "success" explicitly does NOT mean for this beta

- **Not** a specific number of registered users — headcount is an approval-gated decision (who is
  invited), not a metric this build should optimize for.
- **Not** any revenue signal — Billing (M27) runs in Paddle sandbox mode for the entire beta;
  `BILLING_PRODUCTION_PAYMENTS_ENABLED` stays `false` unless separately approved.
- **Not** application-send volume — real company outreach stays disabled for the entire beta by
  design; a *low* send count during this phase is the correct, intended outcome, not a shortfall.

## 5. How this gets measured in practice

No analytics vendor is wired in (doc 19 §5) — for the scale of a Closed Beta (a handful of
approved testers), every criterion above is checkable by direct, manual database query or by the
existing admin endpoints (`GET /admin/beta-access/invitations`, `GET /admin/recruitment-
operations/...`) plus the certification evidence already produced in this document set. Standing
up a dashboard for this is real, legitimate follow-up work once real usage exists to look at — not
a prerequisite for starting the beta itself.
