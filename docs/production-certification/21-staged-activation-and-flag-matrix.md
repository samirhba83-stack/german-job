# Milestone 31 Phase 25/26 — Staged Feature Activation Plan & Production Safety Flag Matrix

Every flag below was found by grepping this codebase's own config files for real `*_ENABLED` env
vars (`apps/api/src/config/*.ts`) — not reconstructed from memory or the milestone brief's own
naming. 19 real flags exist today; 2 (`REAL_COMPANY_OUTREACH_ENABLED`,
`PRODUCTION_WEBHOOK_PROCESSING_ENABLED`) were created and wired this phase, closing the exact gap
Phase 1's audit named. Every flag defaults to its safe state — confirmed by reading the actual
`?? 'false'`/`?? 'true'` fallback in each config file, not assumed.

## 1. Complete Production Safety Flag Matrix

| Flag | Default | Milestone | What it gates | Real enforcement point |
|---|---|---|---|---|
| `PUBLIC_REGISTRATION_ENABLED` | `false` | M31 | Open self-service registration (Public Launch) | `RegisterHandler` |
| `CLOSED_BETA_ENABLED` | `false` (set `true` in dev for beta testing) | M31 | Whether invitation-gated registration works at all — `false` is the real Emergency Stop for registration | `RegisterHandler` |
| `REAL_COMPANY_OUTREACH_ENABLED` | `false` | M31 (new) | Whether a connected-mailbox send is allowed to proceed at all | `ConnectedMailboxReadinessService.checkReadiness()` |
| `PRODUCTION_WEBHOOK_PROCESSING_ENABLED` | `false` | M31 (new) | Whether Gmail/Graph/email-provider webhooks act on an authenticated notification (vs. ack-only) | `EmailWebhookProcessingService.dispatch()`, both inbox webhook controllers |
| `EMAIL_PRODUCTION_SENDING_ENABLED` | `false` | M28 | The platform-sender path (billing/system notifications) | `EmailProviderGatewayService` |
| `EMAIL_ATTACHMENTS_PRODUCTION_ENABLED` | `false` | M28.5 | Whether real attachments are ever resolved/attached | `AttachmentResolverPort` callers |
| `EMAIL_SENDER_IDENTITY_ENFORCEMENT_ENABLED` | `false` | M28.5 | Whether sender-domain verification is enforced before send | `DomainReadinessService` |
| `CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED` | `false` | M28.6 | The connected-mailbox (candidate's own Gmail/Outlook) send path | `ConnectedMailboxReadinessService.checkReadiness()` |
| `BILLING_PRODUCTION_PAYMENTS_ENABLED` | `false` | M27 | Real Paddle charges (sandbox mode otherwise) | Billing checkout/webhook flow |
| `CONNECTED_INBOX_PROCESSING_ENABLED` | `false` | M29 | Whether inbox polling/watch-renewal ticks run at all | `InboxWatchRenewalTickDriverService`, `InboxPollingTickDriverService` |
| `INBOX_AI_CLASSIFICATION_ENABLED` | `false` | M29 | AI-based reply classification (not built — rules-only is the confirmed decision; this flag exists as a documented refusal point) | Reply classification pipeline |
| `INBOX_REPLY_DRAFTING_ENABLED` | `false` | M29 | Draft-reply generation | Draft pipeline |
| `INBOX_AUTOMATIC_REPLY_ENABLED` | `false` | M29 | Sending a reply without human approval | Draft approve-and-send path |
| `INBOX_POLLING_ENABLED` | `true` | M29 | The inbox polling tick itself (distinct from `CONNECTED_INBOX_PROCESSING_ENABLED`, which gates watch-renewal) | `InboxPollingTickDriverService` |
| `REPLY_DRIVEN_EXECUTION_ENABLED` | `false` | M30 | Whether a classified reply can drive an application-status transition | Transition proposal pipeline |
| `FOLLOW_UP_SUPPRESSION_ENABLED` | `false` | M30 | Whether follow-up sends are suppressed based on reply state | `FollowUpControlService` |
| `RECRUITMENT_TASK_AUTOMATION_ENABLED` | `false` | M30 | Automatic `RecruitmentActionTask` creation | Task creation pipeline |
| `AUTOMATIC_HIGH_IMPACT_TRANSITIONS_ENABLED` | `false` | M30 | Whether a high-impact status transition (e.g. Rejected) can apply without human confirmation | Transition proposal confirmation gate |
| `EMAIL_QUEUE_ENABLED` | `true` | M28 | The email queue tick itself | `EmailQueueWorkerService` |
| `EXECUTION_ACTIVATION_ENABLED` | `true` | M26 | The campaign execution tick itself | `ExecutionTickDriverService` |

**Every flag defaulting to `false` above stays `false` for the entire Controlled Closed Beta.**
The two `true`-by-default flags (`EMAIL_QUEUE_ENABLED`, `EXECUTION_ACTIVATION_ENABLED`,
`INBOX_POLLING_ENABLED`) gate the tick machinery itself running, not any external side effect —
each real external action downstream still passes through its own dedicated, `false`-by-default
gate above.

## 2. Staged Activation Plan

A real, ordered sequence for moving from "Closed Beta, everything test-only" toward eventual wider
use — presented as stages, not a schedule (no dates are committed; each stage requires an explicit
Product Owner decision to advance, per the milestone's own AUTONOMY boundary on activating real
external capability).

### Stage 0 — Closed Beta (the state this milestone certifies)

- `CLOSED_BETA_ENABLED=true`, `PUBLIC_REGISTRATION_ENABLED=false`.
- Every `false`-by-default flag in §1 stays `false`.
- Real invited users can register, build a profile (backend-only — see doc 18 §5), create
  campaigns, and exercise every UI flow — with zero real external side effects (no real email
  sent, no real charge, no real webhook acted upon).

### Stage 1 — Internal dry run with real connected mailboxes, test recipients only

- Requires: real Google/Microsoft OAuth app credentials (Phase 9/10, currently unexecuted —
  genuinely blocked on Product Owner action per the milestone's own stop-list).
- `CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED=true`, `REAL_COMPANY_OUTREACH_ENABLED` **stays
  `false`** — connecting a real mailbox and confirming the send pipeline end-to-end against
  pre-approved test recipient addresses only, never a real company.
- `PRODUCTION_WEBHOOK_PROCESSING_ENABLED=true` for the specific provider(s) under test, once
  Phase 9/10/11's real certification is actually executed (not merely prepared).

### Stage 2 — Real company outreach, small, explicitly approved cohort

- Requires: separate, explicit Product Owner approval per this milestone's own non-negotiable
  business rule — never assumed, never inferred from Stage 1 succeeding.
- `REAL_COMPANY_OUTREACH_ENABLED=true` — the single flag flip that actually permits it, isolated
  from every other flag so it can be the one thing reviewed and approved on its own.

### Stage 3 — Reply-driven automation, staged conservatively

- `REPLY_DRIVEN_EXECUTION_ENABLED`, `FOLLOW_UP_SUPPRESSION_ENABLED`,
  `RECRUITMENT_TASK_AUTOMATION_ENABLED` enabled one at a time, each with its own real observation
  window (using the telemetry in doc 19) before the next is enabled — never all three at once, per
  Non-Negotiable Principle #1 ("never enable all flags simultaneously").
- `AUTOMATIC_HIGH_IMPACT_TRANSITIONS_ENABLED` and `INBOX_AUTOMATIC_REPLY_ENABLED` are deliberately
  the LAST flags in this entire matrix ever considered for activation — both bypass a human
  confirmation step the product currently guarantees. No target date; a real, separate decision.

### Stage 4 — Public Registration

- `PUBLIC_REGISTRATION_ENABLED=true` — explicitly out of scope for this milestone and every stage
  above it. Requires its own future certification pass (open abuse surface, support load, legal
  review beyond this milestone's technical privacy review in doc 15).

## 3. What this plan deliberately does not do

- It does not set a date for any stage — every transition is a real Product Owner decision.
- It does not assume Stage 1 success implies Stage 2 approval — company outreach is gated by its
  own named flag specifically so approving mailbox-sending infrastructure is never mistaken for
  approving real company contact.
- It does not include a "roll everything back to Stage 0" mechanism here — that is Phase 27's
  Emergency Stop / Rollback Runbook, which this plan depends on existing and working before any
  stage past 0 is entered.
