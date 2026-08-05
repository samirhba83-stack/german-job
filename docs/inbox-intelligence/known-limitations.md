# Known Limitations — Inbox Intelligence

Every item below is a deliberate scope boundary confirmed against real, investigated backend
constraints — not a guess made against a live production execution path. Each names the real
constraint that forced the decision.

## 1. `OFFER_RECEIVED` proposals are never dispatched as a real command

`ApplicationTransitionProposalService` maps `ReplyPrimaryCategory` → `ProposedApplicationAction`,
but only 3 of the 9 possible actions (`REPLY_RECEIVED`, `INTERVIEW_INVITED`, `REJECTED`) actually
call `CommandBus.execute()`. `OFFER_RECEIVED`'s real command (`ReceiveOfferCommand`) requires
`ActorRole.COMPANY` per `OfferPolicy` — a genuine, pre-existing domain rule, not weakened for this
milestone. Confirming or rejecting an offer proposal is recorded at the inbox-intelligence layer
(`ApplicationTransitionProposal.status`) only; the real `Application.status` never moves to
`OFFER_RECEIVED` through this pipeline. `DOCUMENTS_REQUESTED`, `INFORMATION_REQUESTED`,
`ASSESSMENT_INVITED`, `UNDER_REVIEW`, `WAITING` have no real Applications-module command at all —
proposal-only by design, confirmed via investigation before building the mapping table.

## 2. Campaign follow-up pause never mutates `CampaignTarget`

`Application` has no `campaignId` back-reference field — confirmed via investigation — so a reply's
campaign is only known through `ConnectedMailboxSendAttempt.campaignId` at correlation time.
`ReplyIngestionService` records a real, auditable `CAMPAIGN_FOLLOWUP_PAUSED` event when a reply is
matched, but deliberately does not call `CampaignTarget.markSkipped()` — that method is an
unconditional status overwrite with no "already dispatched" guard, and calling it on an
already-sent target would incorrectly rewrite genuine send history on a live, already-approved
(M26) production execution path. A real target-exclusion command needs its own investigation of the
campaigns module's dispatch/retry engine — out of this milestone's scope.

## 3. No true provider-side partial scope revocation

Neither Gmail nor Microsoft Graph exposes an API to revoke only the inbox-read grant while keeping
the send grant — confirmed, not assumed. `revokeInboxAccess()` enforces the boundary at the
application layer (stops watching, refuses to read) rather than calling a provider operation that
does not exist. This satisfies Non-Negotiable Principle #15's "where the provider supports separate
consent" qualifier honestly.

## 4. AI classification is fully unimplemented, by design

`DisabledAiClassificationAdapter` is the only shipped `AiClassificationPort` implementation
(`available: false` always). This was the user's own explicit confirmed answer ("rules-only, no AI
vendor yet") to this milestone's AskUserQuestion on AI provider. Wiring a real vendor is a one-line
DI-binding change plus a new adapter class — no other code changes — but is a separate, explicit
future decision requiring its own data-processing-region and legal review, per the brief's own
AUTONOMY clause.

## 5. No user-facing audit-trail endpoint

`EmailSecurityAuditEvent` rows are real and populated for every real inbox-intelligence action (24
new event types), but no controller exposes them to the message owner — only
`AdminEmailController.GET /admin/email/security-audit` (existing, M28) can query them, and it is
admin-only. The Inbox Workspace detail view shows real `InboxMessageCorrection` history instead of
fabricating an "audit trail" section the API doesn't back for end users.

## 6. Gap recovery on a stale provider cursor is a bounded, honest miss

When Gmail reports `404` or Graph reports `410` for a stored history/delta cursor that's aged out,
`InboxChangePollingService` re-establishes a fresh cursor rather than attempting a full-mailbox
backfill scan. Messages that arrived in the un-recoverable window are honestly missed, not silently
guessed at or backfilled via a second, riskier full-scan code path.

## 7. Inbox Workspace's 8 named views are client-side filters, not server queries

`GET /inbox/messages` only accepts `reviewStatus`/`correlationStatus` query parameters — there is no
server-side `primaryCategory` filter. The frontend's 8 named views (Needs attention, Interviews,
Documents, Positive, Rejections, Automatic, Manual review, All) filter the current fetched page
client-side (`features/inbox/lib/inbox-views.ts`), the same "never invent a server signal that
doesn't exist" discipline `CompanyList`'s client-side sort already follows elsewhere in this
codebase.

## 8. Sandbox/E2E verification could not exercise real OAuth end-to-end

No real Google/Microsoft OAuth credentials exist in this development environment. Verification
covered: full route-table mapping, auth/role guards (401/403), cross-user 404 shape, webhook
authenticity rejection (401 for Gmail, silent-ignore for Graph), the Graph validation handshake
(caught and fixed a real process-crashing bug — see [threat-model.md](./threat-model.md)), and a
live browser session against the real backend (Settings consent card, Inbox Workspace, 404 detail
state, zero console errors). The real OAuth exchange, real Gmail/Graph API calls, and real webhook
delivery from Google/Microsoft's own infrastructure remain untested against real provider
credentials, matching the same honest limitation M28.6's own verification carried.
