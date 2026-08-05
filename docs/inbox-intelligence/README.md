# Milestone 29 — Inbox Intelligence, Recruitment Reply Classification & Next-Action Operations

## What this milestone is

Detects and classifies replies to applications sent through a candidate's connected mailbox
(M28.6), correlates them to the right application, extracts structured recruitment facts, proposes
(never silently applies) application-status updates, recommends next actions, and drafts
(never auto-sends) reply text — all as a **separate, explicitly-upgraded consent layer** on top of
the existing send-capable `ConnectedMailbox`.

Sending and inbox-reading are two independent permissions. A user who has connected a mailbox for
sending has granted nothing about inbox reading; a user who later revokes inbox reading keeps
sending working exactly as before.

## Architecture

```
                    ┌─────────────────────────┐
                    │   connected-mailbox      │   (M28.6 — send-only)
                    │   OAuth + token vault +   │
                    │   send adapters reused    │
                    │   for inbox-upgrade OAuth │
                    └───────────▲───────────────┘
                                │ one-directional dependency
                    ┌───────────┴───────────────┐
                    │   inbox-intelligence (M29) │
                    │                            │
  Gmail Pub/Sub ───►│  webhooks → InboxChangePollingService ──► ReplyIngestionService
  Graph change  ───►│                                              │
  notifications      │           ┌──────────────────────────────────┤
                     │           ▼                                  ▼
                     │  scoreCorrelation()              checkPrivacyGate()
                     │  (thread-id / In-Reply-To /      (consent active? correlated?
                     │   References matching)            not self-sent? size bound?)
                     │           │                                  │
                     │           ▼ MATCHED + gate passes             │
                     │  normalizeProviderMessage()  ◄─── content fetched ONLY here
                     │           │
                     │           ▼
                     │  classifyByRules()  ──► NEEDS_MANUAL_REVIEW if no rule fires
                     │  (AI consulted only if rules insufficient — DisabledAiClassificationAdapter
                     │   ships this milestone: available=false, rules-only, zero content leaves server)
                     │           │
                     │           ▼
                     │  decideReplyAction()  (confidence bands → propose? auto-apply? confirm?)
                     │           │
                     │           ▼
                     │  ApplicationTransitionProposalService ──► real CommandBus dispatch
                     │  (3 of 9 proposed actions map to real Applications commands; rest proposal-only)
                     │           │
                     │           ▼
                     │  NotificationService, ReplyDraftService (generate → edit → approve-and-send)
                     └────────────────────────────────────────────┘
```

## The 15 non-negotiable principles — how each is enforced in code

| # | Principle | Enforcement |
|---|---|---|
| 1 | Sending and inbox-reading are separate permissions | Separate `InboxCapabilityStatus` on `ConnectedMailbox`, separate `OAuthCapabilityPurpose`, separate consent-start/revoke endpoints |
| 2 | Explicit upgrade, never silent | `InboxConsentService.startInboxUpgrade` requires an already-CONNECTED mailbox; identity must match the existing `providerAccountId` or the upgrade is rejected (`MAILBOX_MISMATCH`) |
| 3 | Narrowest possible scope | `gmail.readonly` / `Mail.Read` only — no `gmail.modify`, no full Graph `Mail.ReadWrite` |
| 4 | Never ingest the entire mailbox | Watch/delta only surfaces *changed* message ids; each is metadata-fetched, correlated, and only content-fetched if MATCHED + privacy gate passes |
| 5 | Never process unrelated personal/private conversations | `UNRELATED` correlation → never persisted at all; `checkPrivacyGate` blocks content fetch |
| 6 | Only confidently-linked messages enter the pipeline | `AMBIGUOUS` → metadata-only manual-review row, no excerpt, no classification |
| 7 | Never fabricate a classification | No rule match + real content → `NEEDS_MANUAL_REVIEW`, never a guessed category; `ExtractedRecruitmentFacts` fields are `null` unless a real value was found |
| 8 | Never silently change status on low-confidence output | `ReplyDecisionPolicy`: LOW confidence never proposes a transition; `HIGH_IMPACT_CATEGORIES` always require explicit confirmation regardless of confidence |
| 9 | Never automatically send a reply this milestone | `ReplyDraftService.approveAndSend()` is the only send path, reachable only from an explicit user HTTP request; `INBOX_AUTOMATIC_REPLY_ENABLED` stays false and is wired to nothing |
| 10 | Every conclusion exposes evidence + confidence | `RuleEngineResult.evidence`, `CorrelationResult.evidence`, `ApplicationTransitionProposalRecord.evidence` all persisted and returned to the frontend |
| 11 | Rule-based signals take priority over AI | `classifyByRules()` always runs first; AI (disabled this milestone) is only ever consulted when `rulesWereSufficient === false` |
| 12 | User must be able to correct classifications | `InboxCorrectionService` — classification, facts, unrelated-mark, application-match corrections, each a new `InboxMessageCorrection` row |
| 13 | Corrections never rewrite historical truth | Corrections are additive rows referencing `originalValue`/`correctedValue`, never an in-place mutation of the original classification fields |
| 14 | Disconnecting inbox access stops future reading immediately | `revokeInboxAccess` stops the watch and sets `inboxCapabilityStatus: USER_DISABLED`; `ReplyIngestionService`'s privacy gate checks `inboxCapabilityStatus === 'ACTIVE'` on every message |
| 15 | Revoking inbox keeps sending working | `revokeInboxAccess` never touches `encryptedRefreshToken`/`encryptedAccessToken`/`status`/`grantedScopes` — the fields `ConnectedMailboxSendService` reads |

## What's real vs reserved this milestone

**Real, live, working end-to-end:** consent upgrade flow, Gmail/Graph webhook receipt + polling
fallback, correlation scoring against real M28.6 send-attempt data, the full deterministic rule
engine (19 rules, German + English), structured fact extraction, the decision policy, 3-of-9
transition-proposal → real command dispatch, notifications, reply drafting + manual send, user
corrections, 90-day excerpt retention, the full user + admin API surface, the full frontend
(Settings consent card + Inbox Workspace with 8 filtered views + detail workspace).

**Reserved, deliberately not wired this milestone:** `AiClassificationPort` has no real vendor
implementation (`DisabledAiClassificationAdapter` only); `INBOX_AUTOMATIC_REPLY_ENABLED` is wired
to nothing; `OFFER_RECEIVED` transitions are never dispatched as a real command (see
[known-limitations.md](./known-limitations.md)); campaign follow-up pause records an audit event
only, never mutates `CampaignTarget` status.

## Documents in this set

- [rule-catalogue.md](./rule-catalogue.md) — every deterministic rule, its pattern intent, and confidence
- [production-safety-gates.md](./production-safety-gates.md) — every env var / flag and what it gates
- [known-limitations.md](./known-limitations.md) — honest, itemized gaps and why each exists
- [threat-model.md](./threat-model.md) — the real security review, findings, and fixes made during this milestone
