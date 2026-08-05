# Threat Model & Security Review — Inbox Intelligence

Real findings from this milestone's own security hardening pass, each verified live (not just
reasoned about) before being marked resolved.

## Findings — 4 real bugs found and fixed this pass

### 1. Microsoft Graph webhook validation handshake crashed the process (critical, live-caught)

**The bug:** the app-wide `TransformInterceptor` wraps every controller response in `{ data: ... }`.
Graph's real subscription-validation handshake requires the response body to be *exactly* the
decoded `validationToken` — nothing else — or Graph rejects the subscription and it can never be
created. The fix attempt (`@Res({ passthrough: true })` + manual `res.send()`) made it worse: Nest
still attempted its own automatic send afterward, causing `Error [ERR_HTTP_HEADERS_SENT]` on every
real validation request — an **uncaught, unhandled exception that crashed the entire Node process**,
verified live (the API process died mid-request during this milestone's own smoke test).

**The fix:** `@Res()` without `passthrough` (fully hands the response to the handler, no Nest
automatic send at all) — verified live across a repeated smoke-test cycle with the process staying
up. See `microsoft-graph-inbox-webhook.controller.ts`.

**Why this matters:** without this fix, the Outlook inbox-reading path could never have worked in
production — the very first real Graph subscription-creation call would have failed validation, and
depending on deployment process-supervision, could have taken the whole API down.

### 2. Graph webhook `clientState` comparison was not timing-safe

The Gmail webhook already used `timingSafeEqual` for its shared-secret check; the Graph webhook used
a plain `!==` string comparison for the equivalent `clientState` secret — an inconsistency, not an
intentional weaker check. Fixed to match: both provider webhooks now authenticate their shared
secret identically.

### 3. Outlook's oversized-message guard was silently inert

`PrivacyFilterPolicy`'s `maxAllowedSizeBytes` check exists specifically to stop an oversized
message's full content from ever being fetched. `MicrosoftOutlookInboxProviderAdapter` hardcoded
`sizeEstimateBytes: 0` for every message — meaning the guard could never trigger for any Outlook
message, regardless of real size. Fixed: Graph's own `size` field is now requested via `$select` and
populated. Gmail's adapter already populated this correctly from `body.sizeEstimate`.

### 4. `INBOX_REPLY_DRAFTING_ENABLED` was only checked at draft creation, not at send

`ReplyDraftService.createDraft()` checked the flag; `approveAndSend()` — the only method that can
actually cause a real email to leave the server — did not. An operator disabling the flag
mid-incident, expecting it to act as a kill switch, would not have stopped an already-created draft
from still being sent. Fixed: `approveAndSend()` now re-checks the same flag.

## Reviewed and confirmed correct (no fix needed)

- **Header injection**: `mime-message-builder.ts`'s `sanitizeHeaderValue()` (pre-existing, M28.5)
  strips CR/LF and C0 control characters from every MIME header value, applied uniformly to the
  Gmail send path (which the M29 reply-send flow reuses via `ConnectedMailboxSendService` — no new,
  parallel send path was built). Outlook's send path uses Graph's JSON API, not raw MIME headers, so
  this class of attack doesn't apply there.
- **HTML sanitization**: `content-normalizer.ts`'s `stripHtml()` strips `<script>`/`<style>` tags
  before any further processing; the frontend never uses `dangerouslySetInnerHTML` anywhere in the
  new Inbox Workspace — all message content renders through React's own auto-escaping.
- **Cross-user access**: `InboxIntelligenceController.requireOwnedMessage()` returns the identical
  `NotFoundException` shape whether a message id doesn't exist or belongs to another user — verified
  live via a real random-UUID request (`Inbox message not found.`, HTTP 404).
- **Auth/role guards**: verified live — every `/inbox/*` and `/admin/inbox-intelligence/*` route
  returns 401 unauthenticated; a real CANDIDATE-role token against an admin route returns 403.
- **Webhook replay/idempotency**: `InboxMessage`'s `@@unique([connectedMailboxId, providerMessageId])`
  constraint (not just application logic) is the real backstop — proven under genuine concurrent
  load in `inbox-message-idempotency.concurrency.spec.ts` (5 concurrent creates for the same
  provider message id → exactly 1 succeeds, 4 reject `P2002`).
- **Prompt injection**: not applicable this milestone — `DisabledAiClassificationAdapter.available`
  is always `false`, so no email content is ever sent to an AI model. This is a forward-looking
  concern for whenever a real `AiClassificationPort` adapter is wired in (structured-output
  validation, content delimiting, never trusting model output to control application state) — noted
  here so it isn't forgotten, not implemented now since nothing consumes it yet.

## Concurrency backstops (proven live, not just reasoned about)

| Constraint | Proven by |
|---|---|
| One `InboxWatch` row per mailbox (`@unique connectedMailboxId`) | `inbox-watch-per-mailbox.concurrency.spec.ts` — 5 concurrent `upsert()` calls, exactly 1 row |
| `InboxMessage` idempotency (`@@unique([connectedMailboxId, providerMessageId])`) | `inbox-message-idempotency.concurrency.spec.ts` — 5 concurrent creates, 1 succeeds, 4 reject `P2002` |
| `Notification` dedup (`@@unique([userId, dedupeKey])`) | `notification-dedup.concurrency.spec.ts` — 5 concurrent `notify()` calls, exactly 1 new row, every caller resolves (never rejects) |

All 3 concurrency spec files run against the real, live Postgres instance (`pnpm test:concurrency`),
not mocked.
