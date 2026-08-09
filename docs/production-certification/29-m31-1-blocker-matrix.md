# Milestone 31.1 Phase 1 — Blocker Re-Audit Matrix

Re-derived from direct re-reading of docs 01, 03, 05, 07, 08, 09, 12, 14, 21, 22, 24, 25, 26, 28
(not from memory). Code not modified until this matrix existed, per this milestone's own instruction.

| # | Blocker | Current state | Internal engineering action (Claude, autonomous) | External action (Product Owner) | Required credential | Product Owner decision needed | Security risk if unaddressed | Completion evidence | Final certification impact |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /applications/:id/archive` authorization | `ArchivalPolicy.authorize()` unconditionally allows; no `RolesGuard` on the route | Fix `ArchivalPolicy` to enforce ownership via `IsOwnedBySpecification`, add `RolesGuard`, add 12 required tests | None | None | None — pure code fix | Real, currently exploitable IDOR-class gap; any authenticated user can archive any other user's application | 12 passing tests + full regression suite green | **Blocks approval until fixed — Phase 2 of this milestone** |
| 2 | Real Staging environment | Does not exist; only local dev | Prepare deployment manifests, staging env contract, deploy/rollback docs, staging health verification scripts | Choose and pay for a hosting provider; create the account; provide access | Hosting account credentials | **Yes — hosting provider choice** | None directly; blocks every other real-infrastructure blocker below | A real, separate URL serving `environment=staging`, reachable over HTTPS | **Blocks approval — cannot proceed past Phase 3 without this decision** |
| 3 | Environment secret isolation | Single flat `.env`, dev-only values, no Staging/Production split | Build the 3-environment secret inventory/template, startup validation already exists (`EnvironmentValidationService`), write rotation + compromised-secret runbooks, run repo secret scan | Provision real secret values in a real secret store once Staging exists | Secret manager access (or hosting platform's built-in store) | Secret manager choice (can reuse hosting platform's own store — see Phase 3 package) | Secret reuse across environments if not enforced | A real Staging deployment reading only Staging-scoped secrets | **Blocks approval — depends on #2** |
| 4 | Google OAuth real test | Never executed against real Google infrastructure; checklist complete (doc 07) | None further to prepare — code is real and complete (PKCE, token vault, scope narrowing) | Create a real Google Cloud test project, configure OAuth consent screen, add test users | Google Cloud account | **Yes — Google Cloud project creation** | None from not testing; risk is an untested integration path | The real 12-step flow (doc 07) executed and passing | **Blocks approval** |
| 5 | Google Pub/Sub webhook | Never received a real event; controller + verification code real and unit-tested | None further to prepare | Configure Pub/Sub topic/subscription pointing at a real public Staging URL (needs #2 done first) | Google Cloud account, public HTTPS endpoint | Same as #4 | None from not testing | A real Pub/Sub notification received, verified, processed, audited | **Blocks approval** |
| 6 | Microsoft OAuth real test | Never executed against real Microsoft infrastructure; checklist complete (doc 08) | None further to prepare | Create a real Entra app registration, add test users | Microsoft/Azure account | **Yes — Entra tenant/app creation** | None from not testing | The real 13-step flow (doc 08) executed and passing | **Blocks approval** |
| 7 | Microsoft Graph webhook | Never received a real event | None further to prepare | Configure Graph subscription pointing at a real public Staging URL | Microsoft/Azure account, public HTTPS endpoint | Same as #6 | None from not testing | A real Graph notification received, validation handshake passes, processed, audited | **Blocks approval** |
| 8 | Production monitoring | Structured JSON logs to stdout only (real, correct shape); no aggregation, no dashboard, no alert delivery anywhere | Build a real monitoring adapter abstraction (provider-agnostic), instrument the metrics catalogue (doc 13/19) against it, write alert-rule definitions | Choose and provision a monitoring destination | Monitoring vendor account (or self-hosted equivalent) | **Yes — monitoring provider choice** | Real incidents would go undetected until manually noticed | A real alert delivered end-to-end from a real induced condition | **Blocks approval** |
| 9 | Backup/restore on real Staging | Real drill already executed once against local dev Postgres (doc 10) | Re-run the same drill's scripts against Staging once it exists | None beyond #2 | Staging DB access | None additional | Untested restore path in the actual target environment | Restore drill evidence captured against Staging | **Blocks approval — depends on #2** |
| 10 | Emergency Stop on real Staging | Real, live-verified against local dev (doc 22); never exercised against a real deployed environment | Re-run the same verification against Staging | None beyond #2 | Staging admin access | None additional | None beyond general untested-in-target-env risk | Same checks as doc 22 §5, re-run against Staging | **Blocks approval — depends on #2** |
| 11 | Full real Staging E2E | 21-step flow run against local dev only (doc 24), explicitly labeled a proxy | Re-run an expanded version of the same flow against Staging, extended with the real Gmail/Outlook steps once #4/#6 exist | None beyond #2/#4/#6 | Staging + real OAuth test accounts | None additional | None directly | A real, passing end-to-end run against Staging | **Blocks approval — depends on #2, #4, #6** |
| 12 | Critical/High security findings | 0 Critical, 1 open Medium (item #1 above) — confirmed by direct code inspection this review | Close item #1; re-run full security checklist against Staging once deployed | None | None | None | Covered by #1 | Doc 14 checklist re-run clean against Staging | **Blocks approval until #1 is closed and re-verified in Staging** |

## Summary

**1 blocker (#1) is fully closeable by Claude alone this session — and is closed in Phase 2 below.**

**11 blockers are genuinely external**, and every one of them traces back to exactly 3 root Product
Owner decisions:

1. **Choose and provision a hosting provider** (unlocks #2, #3, #9, #10, #11).
2. **Create real Google Cloud + Microsoft Entra test projects** (unlocks #4, #5, #6, #7, and the
   real-OAuth portion of #11).
3. **Choose a monitoring destination** (unlocks #8).

Nothing else is blocking. This milestone's job, beyond closing #1, is to do every piece of
internal engineering preparation for #2–#12 so that the moment each Product Owner decision lands,
execution is immediate — not to invent a way around needing the decision.
