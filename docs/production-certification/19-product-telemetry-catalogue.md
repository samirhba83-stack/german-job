# Milestone 31 Phase 23 — Product Telemetry Catalogue

Same discipline as doc 13's operational Metrics Catalogue: every signal below names the real,
already-existing table/column/service it would be computed from — nothing invented, nothing
requiring new instrumentation infrastructure to define (though, like doc 13, none of this ships to
an actual analytics backend yet — no vendor chosen, Phase 3/15 gated). This catalogue is
product-facing (adoption, activation, engagement) where doc 13 is operations-facing
(availability, latency, failure).

## 1. Privacy constraint (binding on every signal below)

Per Non-Negotiable Principle #12 ("never log CV/email/token content") and the Phase 19 privacy
review: every signal here is a **count, a status, a duration, or a boolean** — never a CV's
content, an email body, a message subject, a company name in an aggregate report, or any other
free-text field a user entered. Where a signal is naturally per-user (e.g., "did user X connect a
mailbox"), it stays keyed by internal `userId`, never joined out to email address in any report
this catalogue describes.

## 2. Beta activation funnel

Every step below is a real column/query already used by `GET /onboarding/status` (Phase 21) — this
catalogue is that same real data, reframed as a funnel rather than a per-user status check.

| Signal | Real source |
|---|---|
| Invitations issued | `BetaInvitation` row count by `createdAt` |
| Invitations redeemed (registration completion rate) | `BetaInvitation.status = 'USED'` ÷ total issued |
| Invitations expired unused | `BetaInvitation.status = 'EXPIRED'` (Phase 20's real-time expiry check, not yet a cleanup job) |
| Invitations revoked | `BetaInvitation.status = 'REVOKED'` |
| Time from invite to registration | `BetaInvitation.usedAt - BetaInvitation.createdAt` |
| Profile started | `UserProfile` row exists for the user |
| Profile completion distribution | `UserProfile.calculateCompletionPercentage()` across all users (real domain method, M20) |
| Mailbox connected | `ConnectedMailbox` row exists and is active (`findActiveByUserId`) |
| First campaign created | `Campaign.findByOwnerId(userId).length > 0` |
| Account suspensions | `User.accountSuspended = true` count + `accountSuspendedReason` (never the reason text itself in an aggregate, only the count) |

## 3. Engagement

| Signal | Real source |
|---|---|
| Active campaigns per user | `Campaign` rows by `ownerId`, `status` in the running/scheduled/paused set (M25) |
| Campaign targets added | `CampaignTarget` row count (M23/M25) |
| Applications assembled | `ApplicationPackage` production count (M14/M28.5's application-assembly engine) |
| Applications sent (test-mode only, per this milestone's own non-negotiable business rule) | `Application` rows with a `SENT`-class status, cross-referenced against `CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED=false` remaining true for the entire beta unless separately approved (Phase 26) |
| Reply received | `InboxMessage` row count (M29) |
| Reply classified vs. needs review | `InboxMessage.reviewStatus` distribution (real, M29) |
| Transition proposals confirmed vs. rejected | `ApplicationTransitionProposal.status` distribution (real, M29/M30) |
| Recruitment tasks completed vs. dismissed | `RecruitmentActionTask.status` distribution (real, M30) |
| Follow-ups suppressed | `ApplicationFollowUpControl` creation rate (real, M30) |

## 4. Trust / safety signals (the ones this certification cares about most)

| Signal | Real source |
|---|---|
| Real company outreach attempts while disabled | Would be a `REAL_COMPANY_OUTREACH_ENABLED=false`-and-still-attempted event — see doc 20 (Staged Activation Plan); no such attempt is possible today because the underlying send path already fails closed (`CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED=false`), but Phase 26 adds this as an explicit, independently-named gate and event so the *absence* of this event is itself demonstrable, not assumed |
| Suspicious account actions | `EmailSecurityAuditEvent` rows tagged `ACCOUNT_SUSPENDED` |
| OAuth consent grants/revocations | `OAuthTransaction` + `ConnectedMailbox` lifecycle events (M28.6) |
| Inbox consent grants/revocations | `InboxConsentService` lifecycle events (M29) |

## 5. What this catalogue deliberately excludes

- No per-user session-replay, click-stream, or heatmap data — not built, not planned for the
  Closed Beta.
- No cross-referencing of any of the above against email address or name in a stored aggregate —
  every rollup here is a count or distribution, computed at query time from the real tables, never
  a materialized report containing PII.
- No third-party analytics SDK (Segment/Mixpanel/Amplitude/etc.) is wired in anywhere in this
  codebase — confirmed by the same dependency inventory used in Phase 18's security assessment.
  Adding one is a real, separate decision (a new vendor, a new data flow) this phase does not make.
