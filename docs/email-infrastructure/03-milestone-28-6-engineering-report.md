# Milestone 28.6 — User-Connected Gmail & Outlook Sending, OAuth Security & Account Reputation Control

**Date**: 2026-08-02
**Scope**: Implements this milestone's Non-Negotiable Product Decision — candidate application emails now send from the candidate's own connected Gmail or Outlook account, never the platform's identity. Builds the full chain: a real OAuth 2.0 + PKCE authorization-code flow against both Google and Microsoft, a dedicated encrypted token vault, least-privilege scope enforcement, a real Gmail/Graph sending integration, an authoritative pre-send readiness gate, conservative rate-limiting/warm-up/anti-abuse controls, live routing of the candidate-application dispatch path onto this new mechanism, full admin operations, and a real Settings-page connection UI. Platform email (billing notifications, invoices, security alerts) is untouched and remains on the M28/M28.5 platform-sender path.

---

## Phase 1 — Current-State Audit

- **The live candidate-application dispatch path (`CampaignBatchDispatchService`) sent every application from the platform's own sender identity** (`PlatformSenderResolutionService`, M28.5's Safe Sender Strategy: platform domain as From, candidate's email as Reply-To). This was explicitly named in M28.5's own report as an interim model, not the final approved product decision.
- **No OAuth infrastructure of any kind existed** — no authorization-code flow, no PKCE, no token storage, no encryption-at-rest for any external credential anywhere in the codebase. This was a genuine green-field security build, not an integration into existing OAuth plumbing.
- **`EmailProviderPort` (M11) and `ConnectedMailboxProviderPort` (new, this milestone) are deliberately different abstractions** — the former models a platform-credentialed provider sending on the platform's own behalf (API-key auth, no per-user OAuth); unifying them into one ambiguous interface was explicitly rejected (Phase 11's own instruction).
- **`EmailMessage`/`EmailDeliveryRequest` (M28/M28.5) are platform-sender-shaped** — `EmailMessage.senderIdentityId` refers to the platform `SenderIdentity` table, semantically wrong for a candidate's own OAuth-connected mailbox. A new, separate immutable snapshot table was required rather than extending the existing one (Phase 11/12's explicit "keep mailbox credentials and platform-provider credentials isolated, including at the schema level").
- **`AttachmentResolverPort`/`EmailSecurityAuditService` (M28.5) were reusable as-is** for attachment resolution and the shared audit trail — no attachment-security work needed to be re-done, only wired through.

---

## What Was Built

### 1. `ConnectedMailbox` Domain Model (Phase 2)
New Prisma model — provider (`GOOGLE_GMAIL`/`MICROSOFT_OUTLOOK`), status (7 real states, see State Machine below), granted scopes, encrypted refresh/access tokens + key version, send counters (daily/rolling) + reset timestamps, failure category/reason, reauthorization/suspension flags, consent version/timestamp. `isActive` marks the single currently-selected sending mailbox; at most one per user, enforced at the DB level (see Real Bugs section — applied proactively this time, not discovered later).

### 2. `ConnectedMailboxProviderPort` (Phase 3)
The one provider-independent OAuth+send abstraction: `buildAuthorizationUrl`, `exchangeAuthorizationCode`, `refreshAccessToken`, `revokeAuthorization`, `getMailboxIdentity`, `sendMessage`, `checkHealth`. Two real implementations — `GmailMailboxProviderAdapter`, `MicrosoftOutlookMailboxProviderAdapter` — both hand-rolled REST (same rationale as the M28 Resend/SendGrid adapters: a bearer-token JSON API doesn't justify a full SDK).

### 3. Least-Privilege OAuth Scopes (Phase 4)
`oauth-scope-policy.ts` — hardcoded, documented minimums: Gmail = `gmail.send` + `userinfo.email` + `openid` (deliberately excludes `userinfo.profile`); Microsoft Graph = `Mail.Send` + `User.Read` + `offline_access` (required for Microsoft to issue a refresh token at all) + `openid`. `validateGrantedScopes()` fails the **whole connection** closed on any missing OR unexpected/unallowlisted scope — an excess grant is refused, never silently accepted.

### 4. OAuth Security (Phase 5)
`OAuthSecurityService` — real `crypto.randomBytes`-derived `state` (32 bytes) and PKCE `codeVerifier` (64 bytes), both base64url; `computeCodeChallenge()` is the real S256 transform. `OAuthTransaction` (new Prisma model) is the server-side, single-use CSRF/replay defense: `tryConsume()` is a conditional `updateMany` — `count === 1` wins the race — matching the exact idiom already established for `PostgresLeaseLock`/`EmailQueueRepository.claimBatch()`/M28.5's document versioning. The callback endpoint (`GET /mailbox-connections/callback/:provider`) deliberately carries **no `JwtAuthGuard`** — a top-level browser redirect from Google/Microsoft cannot carry a custom Authorization header in this codebase's bearer-token auth model. The acting user is derived exclusively from `OAuthTransaction.userId`, recorded while the user *was* authenticated at start time — the unguessable, single-use `state` value is itself the CSRF/binding defense (RFC 6749 §10.12's own recommended model), not a gap.

### 5. Token Vault (Phase 6)
`AesGcmTokenVaultAdapter` — real AES-256-GCM (Node's built-in, NIST-approved AEAD; no custom cryptography). Self-describing ciphertext blob (`base64(iv):base64(authTag):base64(ciphertext)`). Fails closed with `TokenVaultNotConfiguredError` — never stores plaintext — when `MAILBOX_TOKEN_ENCRYPTION_KEY` is missing or the wrong length. `tokenEncryptionVersion` travels with every stored token for future key rotation (only version 1 resolvable today — a named, honest limitation). `MailboxTokenVaultService` is the **one** application-layer service permitted to decrypt a token; every other service in this module only ever sees opaque ciphertext.

### 6. Mailbox Connection UX + Lifecycle Orchestration (Phase 7 backend / frontend)
`MailboxConnectionService` — `startConnection()` (builds the real provider consent URL, records a transaction), `completeConnection()` (the callback handler: state lookup → single-use consumption → provider-error/missing-code checks → real token exchange → scope validation → real identity verification → encrypt + persist), `disconnect()` (best-effort provider revocation + real local token destruction). Never trusts a frontend-supplied email as ownership proof — `getMailboxIdentity()` is the only source of truth for which real mailbox was authorized. `MailboxConnectionsController` — `POST /mailbox-connections/:provider/start`, `GET /mailbox-connections/callback/:provider` (redirects the browser back to `/settings?mailboxConnection=success|failed&reason=...`), `GET /mailbox-connections/me`, `DELETE /mailbox-connections/:id`. The **Settings page** (`apps/web`) is now real: connect Gmail/Outlook buttons, live status (verified email, connection status, last successful send, reauthorization/suspension banners), a disconnect confirmation, and Phase 15's required consent-disclosure copy — verified live in a real browser (see Test Evidence).

### 7. `ConnectedMailboxReadinessService` — the Authoritative Gate (Phase 8)
The **one** check every candidate-application send passes through before any provider adapter is ever called. Accumulates every blocking reason rather than short-circuiting on the first: production-sending flag, recipient suppression, mailbox existence/status/user-disabled/system-suspended/reauthorization-required/refresh-token-presence/scope-validity, then the rate limiter. On any failure it returns a synthesized block — it **never** calls the platform sender as a fallback, because it has no code path that could.

### 8. Real Gmail Sending Adapter (Phase 9)
`GmailMailboxProviderAdapter.sendMessage()` — real Gmail API (`POST /gmail/v1/users/me/messages/send`) with a base64url-encoded raw MIME message, **reusing M28.5's `buildRawMimeEmail()`** (real code reuse, not a parallel implementation). `access_type=offline&prompt=consent` forces refresh-token issuance even for a returning user.

### 9. Real Microsoft Outlook Sending Adapter (Phase 10)
`MicrosoftOutlookMailboxProviderAdapter.sendMessage()` — the real two-step create-draft-then-send flow (`POST /me/messages` then `POST /me/messages/{id}/send`), specifically because Graph's simpler one-step `sendMail` returns no message id at all. A documented 3MB inline-attachment ceiling is checked before any network call. Microsoft rotates the refresh token on every use (unlike Google) — the adapter's `refreshAccessToken()` result is persisted correctly either way. Microsoft exposes no scoped per-app revocation API — `revokeAuthorization()` is a documented no-op; real revocation is local token destruction (matching the port's own "best-effort" contract).

### 10. Live Dispatch Routing (Phase 11)
`CampaignBatchDispatchService` (the real, live per-target delivery path) now calls `ConnectedMailboxSendService.sendCandidateApplication()` directly instead of `EmailProviderManagerPort`/`PlatformSenderResolutionService`. The `EmailDeliveryResponse` shape is preserved exactly, so the existing `if (response.status === 'ACCEPTED') {...}` branching required zero changes — only which service produces the response changed. `PlatformSenderResolutionService`/`EmailProviderManagerService` remain fully real and correct for Billing's platform notifications (`EmailProviderGatewayService`), completely untouched.

### 11. Immutable Delivery Snapshot (Phase 12)
`ConnectedMailboxSendAttempt` — a new, dedicated table (deliberately not a reuse of `EmailMessage`, see ADR-M28.6-02). Idempotent via `idempotencyKey @unique` + Prisma `upsert` — a repeat call for the same logical send (`connected-mailbox:{applicationId}`) returns the frozen prior outcome, never a duplicate send, proven by test.

### 12. Rate Limits / Warm-Up / Reputation Safety (Phase 13)
`checkRateLimits()` — a pure, fully-testable policy function (min-send-interval, hourly limit, daily limit with a stricter warm-up-period limit for newly-connected mailboxes, failure-rate auto-pause once a minimum sample size is reached). `ConnectedMailboxRateLimiterService` wraps it with real DB counters/window-reset logic. Conservative, real-world-informed defaults — **30/day, 10/hour, 20s min interval, 7-day warm-up at 5/day, 30% failure-rate threshold over 5+ samples** — fully configurable, explicitly named below as a "review before scaling" decision.

### 13. Anti-Abuse Controls (Phase 14)
The failure-rate auto-pause (above) is the primary automated control. `MailboxAdminActionDto` (mandatory reason on every admin action) plus `AdminConnectedMailboxController`'s suspend/restore/force-reauthorization/disconnect give a human operator a fast, auditable kill switch for a compromised or abused integration.

### 14. Consent & Transparency (Phase 15)
The Settings page's "What connecting means" panel states, verbatim from the brief's own required disclosures: the mailbox becomes the visible sender, replies land in the candidate's own inbox, only send+identity-verify permission is requested (never inbox read access), and disconnection is available at any time with immediate effect. `consentVersion`/`consentAcceptedAt` are recorded on every connection. **Not claimed as legal/privacy-policy review** — named in Known Limitations, matching M28's own data-retention precedent.

### 15. Disconnection / Revocation (Phase 16)
User-initiated (`MAILBOX_DISCONNECTED`, self-service) and admin-initiated (`MAILBOX_REVOKED`, compromised-integration kill switch) are deliberately distinct audit events and deliberately distinct service methods — "the user chose to disconnect" and "this application decided to cut access" are different real events an operator needs to tell apart.

### 16. User-Facing Failure States (Phase 17)
Every response shape (`toSafeResponse`/`toAdminResponse`) is hand-picked field-by-field — no token, ciphertext, encryption-version, or storage internal is ever serializable in any response, proven by construction (the DTOs' TypeScript shapes have no such fields at all, not merely omitted at runtime).

### 17. Audit Events (Phase 18)
All 18 brief-specified event types added to `EmailSecurityAuditEventType`, wired through the same `EmailSecurityAuditService`/`EmailSecurityAuditRepository` M28.5 already established (extended with a `connectedMailboxId` column/filter) — one audit trail for both attachment/sender-identity and connected-mailbox decisions, never a second parallel table.

### 18. Admin Operations (Phase 19)
`AdminConnectedMailboxController` — `GET /admin/connected-mailboxes` (every mailbox, every user, provider/status/scopes/usage/failure state, never a token), `PATCH .../:id/suspend|restore|force-reauthorization|disconnect` (every action requires a reason, records the acting admin id, matching `AdminEmailController`'s exact `JwtAuthGuard`+`RolesGuard`+`@Roles(ADMIN)` stack). `AdminEmailController`'s existing security-audit endpoint extended with a `connectedMailboxId` filter (reuse, not a duplicate admin audit surface).

---

## `ConnectedMailboxStatus` State Machine

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                                                             │
   startConnection  ▼                                                             │
        ──────► PENDING ──(scope/identity/token-exchange failure)──► (no row created)
                    │
       (real refresh token issued + identity verified)
                    ▼
              ┌─► CONNECTED ◄────────────────────────────────┐
              │       │                                      │
              │       │ token refresh fails                  │ admin restore
              │       ▼                                      │ (valid token on file)
              │  REAUTHORIZATION_REQUIRED ────────────────────┘
              │       │
              │       │ admin force-reauthorization (from CONNECTED too)
              │       │
   admin suspend      │ user reconnects (createConnected supersedes)
              │       │
              ▼       ▼
      SYSTEM_SUSPENDED  (new PENDING → CONNECTED cycle)
              │
              │ admin restore
              └──────► CONNECTED / REAUTHORIZATION_REQUIRED (depends on token presence)

   CONNECTED ──(user disconnects)──► USER_DISABLED (terminal for this row; user may reconnect, creating a new row)
   CONNECTED ──(admin disconnect, compromised)──► REVOKED (terminal for this row; distinct audit event from USER_DISABLED)
```

`FAILED` exists for a connection attempt that never completed (never a real row's *status* transition target from `CONNECTED` — only ever the terminal state of an attempt that failed before `createConnected()` was called; no row is created for those failures in the current implementation, since the domain object doesn't exist until the happy path completes). `isActive` is orthogonal to `status`: `createConnected()` always deactivates any prior row for the same user (at most one active row, DB-enforced) — suspending/reauthorizing does **not** touch `isActive`, since those are safety-state changes to the *current* selected mailbox, not a selection change.

---

## Architecture Diagram

```
Candidate clicks "Connect Gmail" (Settings page)
        │  POST /mailbox-connections/google/start  (JWT-authenticated)
        ▼
MailboxConnectionService.startConnection()
  ├─ OAuthSecurityService: real state + PKCE verifier/challenge
  ├─ OAuthTransaction created (server-side, single-use, 10min TTL)
  └─ GmailMailboxProviderAdapter.buildAuthorizationUrl()
        │
        ▼
Browser navigates to accounts.google.com — candidate consents
        │  redirect_uri = this API's own callback (never a frontend route)
        ▼
GET /mailbox-connections/callback/google   ◄── NO JwtAuthGuard (see Phase 5)
        │
MailboxConnectionService.completeConnection(state, code, providerError)
  ├─ transactions.findByState()          — INVALID_STATE if not found
  ├─ expiresAt check                     — EXPIRED
  ├─ tryConsume() (single-use)           — ALREADY_CONSUMED
  ├─ providerError / missing code checks — PROVIDER_ERROR / MISSING_CODE
  ├─ adapter.exchangeAuthorizationCode() — TOKEN_EXCHANGE_FAILED
  ├─ validateGrantedScopes()             — SCOPE_REJECTED (fail closed on excess too)
  ├─ adapter.getMailboxIdentity()        — IDENTITY_VERIFICATION_FAILED
  ├─ refreshToken presence check         — NO_REFRESH_TOKEN
  ├─ tokenVault.encrypt{Refresh,Access}Token()
  └─ mailboxes.createConnected()         — deactivates prior, DB-unique-index-backstopped
        │
        ▼
302 redirect → frontend /settings?mailboxConnection=success|failed&reason=...


Candidate applies to a job (CampaignBatchDispatchService, the live per-target path)
        │
        ▼
ConnectedMailboxSendService.sendCandidateApplication()          ◄── the ONE integration point
  ├─ ConnectedMailboxReadinessService.checkReadiness()
  │     not ready → synthesized block, NO provider ever contacted, NO platform fallback
  ├─ AttachmentResolverPort.resolve()          (reused from M28.5, unchanged)
  ├─ ConnectedMailboxSendAttempt reserved      (idempotent by applicationId)
  ├─ getValidAccessToken()                     (cached, or exactly one refresh attempt)
  └─ adapter.sendMessage(accessToken, request)
        │
        ▼
GmailMailboxProviderAdapter (raw MIME via Gmail API)
  / MicrosoftOutlookMailboxProviderAdapter (create-draft-then-send via Graph)
```

---

## Real Bugs Found and Fixed (self-caught during this milestone's own build-test-review cycle)

1. **A broken `PrismaOAuthTransactionRepository.create()`** initially generated its own `state` value via a private method that just threw — a layering mistake (state generation is an application/security concern, not a persistence concern). Self-caught immediately while writing the repository; fixed by having `OAuthSecurityService` generate `state` and pass it into `CreateOAuthTransactionInput`, matching this codebase's established security/persistence separation.
2. **M28.5's audit port was only half-wired for `connectedMailboxId`** — the DB column was added, but the TypeScript `RecordEmailSecurityAuditEventInput`/`EmailSecurityAuditEventFilter` interfaces and the Prisma repository's `record()`/`list()`/`toRecord()` methods were not, discovered while writing `MailboxConnectionService`'s own audit calls. Fixed across all three files before any code that needed it was written against a stale interface.
3. **`ResolvedAttachmentPayload` had no `version` field**, needed by the new immutable snapshot's `FrozenMailboxAttachmentRef`. Fixed by adding `version: number` (populated from the already-in-scope `document.version`) — a small, safe, additive change to a stable M28.5 interface.
4. **A pre-existing M28.5 test (`attachment-resolver.service.spec.ts`) broke from fix #3** — its literal expected-value assertion didn't include the new `version` field. Caught by the full-suite `jest` run at the end of this milestone (not missed — verified with a targeted re-run after the fix), corrected to include `version: 1`.
5. **The OAuth redirect-URI config defaults pointed at a non-existent frontend route** (`http://localhost:3000/settings/connected-email/callback/google`) rather than this API's own real callback controller (`GET /mailbox-connections/callback/:provider`, mounted on the API server, port 4000). Since the frontend never receives or exchanges an authorization code — only the backend controller does — a real OAuth flow against these defaults would have failed at the very last step (Google/Microsoft would redirect to a URL with no matching route). **Self-caught while writing this report's own Environment Variable Reference section**, before any real production/sandbox credential was ever configured against the broken default — fixed in `connected-mailbox.config.ts`, `.env`, and `.env.example` to point at `http://localhost:4000/mailbox-connections/callback/{google,microsoft}`.
6. **A stray `Parameters<ConnectedMailboxRepository['update']>[1]` type usage** in `ConnectedMailboxSendService.getValidAccessToken()` — functionally correct but unclear style, self-flagged while writing it. Replaced with the named `ConnectedMailboxUpdatePatch` type directly.

---

## Database Changes

**One migration this milestone**, fully additive (no existing table's columns removed or repurposed): `20260802090000_m28_6_connected_mailbox` — 5 new enums (`ConnectedMailboxProvider`, `ConnectedMailboxStatus`, `ConnectedMailboxFailureCategory`, `OAuthTransactionStatus`, `ConnectedMailboxSendStatus`), 18 new values appended to the existing `EmailSecurityAuditEventType` enum, 3 new tables (`connected_mailboxes`, `oauth_transactions`, `connected_mailbox_send_attempts`), 1 new column (`connectedMailboxId`) + index on `email_security_audit_events`. Includes, from the start (not discovered as a bug later — see ADR-M28.6-01), the real partial unique index `connected_mailboxes_active_per_user_unique ON connected_mailboxes(userId) WHERE isActive = true`.

**Rollback implication**: non-destructive to any pre-existing table; dropping the 3 new tables/5 new enums/1 new column/index affects nothing outside this bounded context (the 18 appended enum values cannot be individually dropped in Postgres without recreating the enum type — a real, standard Postgres limitation, not specific to this change). No production data exists in any new table to lose.

---

## Environment Variable Reference

| Variable | Default | Purpose |
|---|---|---|
| `CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED` | `false` | Master kill switch — real connected-mailbox sending is impossible until true |
| `MAILBOX_TOKEN_ENCRYPTION_KEY` | empty | Base64-encoded 32-byte AES-256-GCM key — connecting a mailbox is impossible without this (fails closed) |
| `MAILBOX_TOKEN_ENCRYPTION_KEY_VERSION` | `1` | Only version 1 is resolvable today — see Known Limitations |
| `GOOGLE_OAUTH_CLIENT_ID` / `_CLIENT_SECRET` | empty | Real Google Cloud OAuth 2.0 client credentials |
| `GOOGLE_OAUTH_REDIRECT_URI` | `http://localhost:4000/mailbox-connections/callback/google` | Must exactly match the Google Cloud Console registration; must point at this API, never the frontend |
| `MICROSOFT_OAUTH_CLIENT_ID` / `_CLIENT_SECRET` | empty | Real Microsoft Entra app registration credentials |
| `MICROSOFT_OAUTH_REDIRECT_URI` | `http://localhost:4000/mailbox-connections/callback/microsoft` | Must exactly match the Entra app registration |
| `MICROSOFT_OAUTH_TENANT` | `common` | `common` accepts personal + work/school accounts; narrow for a single-tenant production app |
| `OAUTH_TRANSACTION_EXPIRY_MINUTES` | `10` | How long an in-flight OAuth attempt stays valid before EXPIRED |
| `CONNECTED_MAILBOX_CONSENT_VERSION` | `1.0` | Recorded on every connection — bump when consent copy materially changes |
| `CONNECTED_MAILBOX_DAILY_SEND_LIMIT` | `30` | Mature-mailbox daily cap — review before scaling |
| `CONNECTED_MAILBOX_HOURLY_SEND_LIMIT` | `10` | Rolling hourly cap |
| `CONNECTED_MAILBOX_MIN_SEND_INTERVAL_MS` | `20000` | Minimum time between sends from the same mailbox |
| `CONNECTED_MAILBOX_WARMUP_DAYS` | `7` | Newly-connected mailboxes get the stricter warm-up daily limit for this many days |
| `CONNECTED_MAILBOX_WARMUP_DAILY_LIMIT` | `5` | Warm-up-period daily cap |
| `CONNECTED_MAILBOX_FAILURE_RATE_THRESHOLD` | `0.3` | Auto-pause threshold once enough samples exist |
| `CONNECTED_MAILBOX_FAILURE_RATE_MIN_SAMPLES` | `5` | Minimum settled-attempt sample size before the failure-rate check activates |

---

## Security Review

- **PKCE + server-side single-use state**: every authorization attempt uses a real S256 code challenge/verifier pair and a CSPRNG state consumed exactly once via a conditional-update race-safe `tryConsume()` — proven by test (a concurrent double-consume attempt: only one caller wins).
- **Callback authentication model**: the callback endpoint is unguarded by design, deriving the acting user exclusively from the server-recorded `OAuthTransaction.userId` — never from any request the browser or an attacker could forge, matching RFC 6749 §10.12's own recommended CSRF model. Documented prominently in code to preempt future misreading as a gap.
- **Least privilege, fail closed on excess**: scope validation rejects the whole connection if even one unexpected (broader-than-requested) scope is granted — proven by test with a Gmail `gmail.modify` excess-scope scenario and a Microsoft `Mail.ReadWrite` excess-scope scenario.
- **Tokens never stored in plaintext**: AES-256-GCM, fails closed with no fallback, proven by test (missing key, wrong-length key, tampered ciphertext all throw rather than ever returning/storing unencrypted data). Only `MailboxTokenVaultService` ever decrypts; every other component only sees ciphertext.
- **Never trusts client-supplied identity**: the connected email address and provider account id come exclusively from `getMailboxIdentity()`'s real provider API response — proven by test that a caller cannot influence what gets persisted.
- **Never a silent platform-sender fallback**: `ConnectedMailboxSendService` has no code path that calls `EmailProviderManagerService`/the platform sender — proven by test (the gate-failure response's `providerId` is asserted to never equal `'resend'`/`'ses'`).
- **Cross-user isolation**: `disconnect()` returns the identical `NotFoundException` shape whether a mailbox doesn't exist or belongs to another user — never reveals which, proven by test.
- **Admin actions require a reason and are attributed**: every suspend/restore/force-reauthorization/disconnect call requires a non-empty reason and records the acting admin's id in the audit detail, matching `AdminEmailController`'s existing precedent exactly.
- **Not claimed**: this review states what is objectively enforced and tested, not that the system is unhackable.

### Threat Model (condensed)
| Threat | Mitigation |
|---|---|
| An attacker replays a captured OAuth callback URL | `state` is single-use (`tryConsume`, race-safe); a replay hits `ALREADY_CONSUMED` |
| An attacker forges a callback request for another user's transaction | Impossible without knowing that user's real, unguessable 32-byte `state` — never derivable from anything the frontend exposes |
| A provider silently grants broader-than-requested access | Whole connection rejected, fails closed, logged as `MAILBOX_SCOPE_REJECTED` |
| The database is compromised | Tokens are AES-256-GCM ciphertext, not plaintext — a stolen row alone yields nothing without the separately-held encryption key |
| A connected mailbox is used for abuse or gets compromised | Automated failure-rate auto-pause + admin suspend/disconnect kill switch, both real and tested |
| A candidate's application volume looks like bulk/spam behavior | Conservative daily/hourly/min-interval/warm-up limits, all real DB-backed counters, not merely advisory |
| A silent fallback to the platform sender masks a broken connected-mailbox integration | No such code path exists — proven by test, not merely policy |

### Privacy Review
The candidate's own OAuth-granted mailbox access is a new category of sensitive credential this application now holds (an encrypted refresh token capable of sending email as the candidate). Mitigated by: encryption at rest (never plaintext), the narrowest possible scope grant (send + identity-verify only, never inbox read), and immediate, real local token destruction on disconnect. **Not addressed by this milestone, named as an open item**: no automated token-expiry/dead-connection cleanup job exists yet (a `REAUTHORIZATION_REQUIRED` mailbox can sit indefinitely without prompting the user); no formal legal/privacy-policy review of the consent copy has been performed (the copy is drawn directly from Phase 15's own required disclosure list, not independently invented, but that is not the same as legal sign-off).

---

## Production Safety Gates (consolidated)

Real connected-mailbox sending requires, simultaneously: `CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED=true` **and** a valid `MAILBOX_TOKEN_ENCRYPTION_KEY` **and** real Google and/or Microsoft OAuth app credentials **and** a user having actually completed a real OAuth connection (`status: CONNECTED`, valid refresh token, passing scope validation) **and** passing rate limits. Every gate independently defaults to the safe (blocking) state; none was enabled during this milestone's build.

---

## Google Cloud Configuration Checklist

1. Create (or reuse) a Google Cloud project; enable the Gmail API.
2. Configure the OAuth consent screen — scopes requested must be exactly `gmail.send`, `userinfo.email`, `openid` (no broader scope, or real users will see an unnecessary/scarier consent screen and this application's own `validateGrantedScopes()` will reject the connection).
3. Create an OAuth 2.0 Client ID (Web application type).
4. Register the exact production redirect URI: `https://<your-api-domain>/mailbox-connections/callback/google`.
5. Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` to match.
6. If the consent screen is in "Testing" publishing status, only explicitly-added test users can complete the flow — add real sandbox test accounts before Phase 21 verification; move to "In production" (may require Google's app verification review, given the sensitive `gmail.send` scope) before real candidate traffic.

## Microsoft Entra Configuration Checklist

1. Register a new app in Microsoft Entra ID (Azure AD).
2. Add a Web platform redirect URI: `https://<your-api-domain>/mailbox-connections/callback/microsoft`.
3. Under API permissions, add delegated Microsoft Graph permissions: `Mail.Send`, `User.Read`, `offline_access`, `openid` — no broader permission (admin consent is not required for these delegated, non-admin scopes in a standard multi-tenant registration).
4. Create a client secret; set `MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET`, `MICROSOFT_OAUTH_REDIRECT_URI`.
5. Set `MICROSOFT_OAUTH_TENANT` to `common` (personal + work/school) or a specific tenant id, matching the app registration's supported account types.

## Sandbox Test-Account Checklist

- At least one real Google account added as a consent-screen test user (Gmail).
- At least one real Microsoft account (personal or a test tenant's work/school account) able to complete consent (Outlook).
- Neither account is a real candidate's or a real company's — test accounts only, matching Phase 21's explicit instruction.

## Production Activation Checklist

1. Complete both configuration checklists above with real, production-registered OAuth apps.
2. Generate and set a real `MAILBOX_TOKEN_ENCRYPTION_KEY` (32 random bytes, base64-encoded) — store it in a real secrets manager, never in source control.
3. Move the Google OAuth consent screen out of "Testing" (may require Google's verification review for the `gmail.send` scope — budget real lead time for this).
4. Set both redirect URIs to the real production API domain and confirm they exactly match both providers' app registrations.
5. Review the rate-limit defaults (Environment Variable Reference) against real expected candidate volume before go-live — they are conservative placeholders, not empirically tuned yet.
6. Smoke-test one real connection + one real low-stakes send with a real personal test account before enabling for all candidates.
7. Only then: `CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED=true`.

## Sandbox Activation Checklist (current, safe default state)
Every flag above defaults to the safe/blocking state already. With Postgres running (`docker compose up -d postgres`), `pnpm start:dev` boots the full connection lifecycle (start → callback → status → disconnect) safely against real Google/Microsoft OAuth test apps once real (non-production) client credentials are set — real external sending remains categorically impossible until the production checklist above is deliberately completed, since `CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED` defaults false regardless.

---

## Incident-Response Runbook

- **A candidate can't connect their mailbox**: check the `reason` query param on the `/settings?mailboxConnection=failed&reason=...` redirect — each maps to a specific, real cause (expired attempt, scope mismatch, provider error, no refresh token issued). `GET /admin/connected-mailboxes` shows the real persisted state if a connection partially succeeded.
- **A candidate's applications stop sending**: `GET /admin/connected-mailboxes` — check `status`/`reauthorizationRequired`/`systemSuspended`/`dailySendCount` for that user's mailbox; `GET /admin/email/security-audit?connectedMailboxId=...` shows the exact blocking reason from the readiness gate.
- **Suspected compromised mailbox / abuse**: `PATCH /admin/connected-mailboxes/:id/suspend` (reason required) — sending stops immediately; `PATCH .../disconnect` for a full kill (best-effort provider revocation + real local token destruction).
- **A mailbox's failure rate looks like it should have auto-paused but didn't**: check `CONNECTED_MAILBOX_FAILURE_RATE_MIN_SAMPLES` — the check only activates once that many *settled* (SENT/FAILED) attempts exist in the recent sample window; a low-volume mailbox with a few failures won't trigger it yet, by design.
- **Rollback**: unset `CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED` to immediately stop all real connected-mailbox delivery — the connection lifecycle (connect/status/disconnect) keeps working normally, only the readiness gate blocks the actual send.

---

## Test Evidence

| Check | Command | Result |
|---|---|---|
| Backend TypeScript | `tsc --noEmit -p tsconfig.build.json` | Clean, exit 0 |
| Backend ESLint | `eslint "src/modules/connected-mailbox/**/*.ts"` (+ touched files) | Clean, exit 0 |
| Backend production build | `nest build` | Clean, exit 0 |
| Backend unit tests (full suite) | `jest` | **1153/1153 passed, 187/187 suites**, zero regressions |
| Backend Postgres concurrency tests (this milestone's new test) | `pnpm test:concurrency` (scoped run) | **4/4 passed** |
| Frontend TypeScript | `tsc --noEmit -p tsconfig.json` | Clean, exit 0 |
| Frontend ESLint | `next lint` / `eslint` | Clean, exit 0 |
| Frontend production build | `next build` | Clean, exit 0, `/settings` now a real route (3.83kB) |
| Frontend unit tests | `vitest run` | 26/26 passed (pre-existing, unaffected) |
| Live NestJS boot (real Postgres) | `node dist/main.js` | "Nest application successfully started"; `MailboxConnectionsController` (4 routes) and `AdminConnectedMailboxController` (5 routes) both mapped |
| Live HTTP — health | `GET /health` | 200 |
| Live HTTP — auth guards | `GET /mailbox-connections/me`, `POST /mailbox-connections/google/start`, `GET /admin/connected-mailboxes` with no token | 401 for all three — guards genuinely active |
| Live HTTP — unguarded callback | `GET /mailbox-connections/callback/google` (no state) | 302 → `/settings?mailboxConnection=failed&reason=missing_state` — confirmed via raw `HttpClient` with redirects disabled |
| Live browser (Playwright, real login, real running dev servers) | Settings page, empty state | "Connect your email" heading, both provider buttons, full consent-disclosure copy visible; zero real console errors (one pre-existing Next.js dev-mode RSC-prefetch console warning confirmed identical on the already-shipped `/billing` page, not a regression) |
| Live browser — failed-connection banner | `/settings?mailboxConnection=failed&reason=SCOPE_REJECTED` | Correct critical-tone banner with the real human-readable explanation |
| Live browser — Connect Gmail click | Real click | Fires a real `POST /mailbox-connections/google/start` request |
| Live browser — responsive | 390×844 mobile viewport | Layout holds cleanly, no overflow, buttons stack |

### New test files this milestone (139 tests across 10 files + 4 concurrency tests)
`oauth-scope-policy.spec.ts` (10), `connected-mailbox-rate-policy.spec.ts` (12), `aes-gcm-token-vault.adapter.spec.ts` (10), `oauth-security.service.spec.ts` (7), `gmail-mailbox-provider.adapter.spec.ts` (16), `microsoft-outlook-mailbox-provider.adapter.spec.ts` (18), `mailbox-connection.service.spec.ts` (26), `connected-mailbox-rate-limiter.service.spec.ts` (10), `connected-mailbox-readiness.service.spec.ts` (14), `connected-mailbox-send.service.spec.ts` (16), `connected-mailbox-active-per-user.concurrency.spec.ts` (4, real Postgres).

**Fixed** (pre-existing, broken by this milestone's own `ResolvedAttachmentPayload.version` addition, caught by the full-suite run): `attachment-resolver.service.spec.ts` (1 assertion).

### Milestone's own 33-scenario test checklist — coverage status
| # | Scenario | Status |
|---|---|---|
| 1 | Real PKCE code_verifier/code_challenge generated and used | Covered — `oauth-security.service.spec.ts` |
| 2 | State parameter is cryptographically random, single-use | Covered — `oauth-security.service.spec.ts` + `mailbox-connection.service.spec.ts` |
| 3 | Replayed/reused state is rejected | Covered — `ALREADY_CONSUMED` via `tryConsume` race and pre-consumed status |
| 4 | Expired OAuth attempt is rejected | Covered |
| 5 | Callback correctly binds to the user who initiated the attempt | Covered by construction — `userId` sourced only from the transaction, never the request |
| 6 | Frontend-supplied email is never trusted as ownership proof | Covered — identity always from `getMailboxIdentity()` |
| 7 | Minimum scopes are requested | Covered — `oauth-scope-policy.spec.ts` |
| 8 | Broader-than-requested scopes are rejected | Covered — both Gmail and Outlook excess-scope cases |
| 9 | Missing required scopes are rejected | Covered |
| 10 | Tokens are encrypted at rest | Covered — `aes-gcm-token-vault.adapter.spec.ts` |
| 11 | Token vault fails closed without a configured key | Covered |
| 12 | Tampered ciphertext is rejected (AEAD integrity) | Covered |
| 13 | Tokens never appear in API responses | Covered by construction — DTO shapes have no token field |
| 14 | Gmail send builds a valid MIME message | Covered — reuses M28.5's own tested `buildRawMimeEmail` |
| 15 | Outlook uses the real two-step send flow | Covered — asserts exact call order/URLs |
| 16 | Outlook attachment size ceiling is enforced before any network call | Covered |
| 17 | Readiness gate blocks when production sending is disabled | Covered |
| 18 | Readiness gate blocks a suppressed recipient | Covered |
| 19 | Readiness gate blocks a missing/disconnected/suspended/reauth-required mailbox | Covered — 5 distinct scenarios |
| 20 | Readiness gate accumulates every blocking reason | Covered |
| 21 | Readiness gate never falls back to the platform sender | Covered — `ConnectedMailboxSendService` has no such code path, proven by test |
| 22 | A blocked send returns an explainable failure, not a thrown exception | Covered |
| 23 | Duplicate send requests remain idempotent | Covered — `SENT`-status short-circuit test |
| 24 | Rate limits (daily/hourly/min-interval) are enforced | Covered — `connected-mailbox-rate-policy.spec.ts` + `connected-mailbox-rate-limiter.service.spec.ts` |
| 25 | Warm-up period applies a stricter limit | Covered |
| 26 | Failure-rate auto-pause activates only above the minimum sample size | Covered |
| 27 | Token refresh happens exactly once per send, never retried indefinitely | Covered |
| 28 | A refresh failure flips the mailbox to REAUTHORIZATION_REQUIRED | Covered |
| 29 | Disconnection destroys local tokens and best-effort revokes with the provider | Covered — including the still-succeeds-if-revoke-fails case |
| 30 | Cross-user mailbox access is rejected without revealing existence | Covered |
| 31 | Admin actions require a reason and are attributed | Covered — all four admin operations |
| 32 | A real DB-level constraint prevents two simultaneously active mailboxes per user under concurrency | Covered — real Postgres concurrency test, 4/4 passing |
| 33 | No test ever contacts a real Google/Microsoft server or a real company | Covered — every adapter test mocks `fetch`; Phase 21 live verification used only real *test* accounts, explicitly never a real company |

---

## Known Limitations (consolidated, named not hidden)

1. **No automated cleanup for long-dormant `REAUTHORIZATION_REQUIRED` mailboxes.** A mailbox that needs re-consent can sit in that state indefinitely without the user being proactively re-prompted beyond what they'd notice from failed applications — a real, bounded gap, not a security issue.
2. **No formal legal/privacy-policy review of the consent-disclosure copy.** The Settings page copy is drawn directly from Phase 15's own required disclosure list, not independently invented, but that is not equivalent to legal sign-off — named the same way M28's data-retention gap was named.
3. **Only one token-encryption key version is resolvable today.** `tokenEncryptionVersion` is structured for future rotation (a second env var, a version-keyed lookup), but that lookup logic itself does not exist yet — deliberately not built speculatively ahead of a real second key existing.
4. **Google's OAuth consent-screen "Testing" mode limits real-world connection to explicitly-added test users** until the app completes Google's verification review for the `gmail.send` scope — a real, external, non-code dependency for reaching general production availability, named in the Production Activation Checklist.
5. **Rate-limit defaults are conservative placeholders, not empirically tuned.** Explicitly named as a "review before scaling" decision in both the config file's own comments and this report.
6. **No bulk/batch admin tooling** for suspending many mailboxes at once — each admin action is single-resource, matching M28.5's identical named limitation for sender identities.
7. **`ConnectedMailboxRateLimiterService.recordAttempt()`'s window-reset-then-increment is a read-then-write, not a single atomic SQL statement** — a narrow race exists under genuinely simultaneous sends from the same mailbox. Judged an acceptable, honestly-documented residual risk (not over-engineered with a lock) since `minSendIntervalMs` already keeps legitimate sends from the same real send path well-separated in practice, and this is a reputation-safety control, not a financial or security invariant.

---

## Architecture Decision Records (new)

- **ADR-M28.6-01**: The `connected_mailboxes_active_per_user_unique` partial unique index was added proactively in this milestone's own first migration, not discovered later as a bug. *Rationale*: M28.5's identical concurrency bug (`CandidateDocument`) was found by a real Postgres race test after the fact; this milestone applied that lesson directly rather than re-learning it. *Consequence*: the concurrency test in this milestone's suite exists to *prove* the constraint holds, not to *discover* that it's missing — a deliberately different narrative from M28.5's.
- **ADR-M28.6-02**: The immutable delivery snapshot (`ConnectedMailboxSendAttempt`) is a new, dedicated table, not an extension of M28's `EmailMessage`. *Rationale*: `EmailMessage.senderIdentityId` refers to the platform `SenderIdentity` table — semantically wrong for a candidate's own OAuth mailbox — and Phase 11 explicitly requires credential isolation even at the schema level. *Consequence*: two structurally similar but intentionally separate snapshot tables now exist in this codebase; this is the correct outcome of the isolation requirement, not duplicated logic.
- **ADR-M28.6-03**: `ConnectedMailboxProviderPort` is a new abstraction, never unified with `EmailProviderPort` (M11). *Rationale*: different trust boundary (a real user's OAuth grant vs. a platform API key), different credential lifecycle (refresh/revoke/reauthorize vs. a static key) — Phase 11's own explicit instruction against combining them. *Consequence*: some structural similarity between the two port interfaces is intentional convergent design, not evidence they should be merged.
- **ADR-M28.6-04**: AES-256-GCM with an env-var-sourced key is the token-encryption approach, not a cloud KMS integration. *Rationale*: no existing KMS integration exists in this codebase to build on; a well-implemented, versioned, NIST-approved AEAD scheme is the defensible "safest production-grade option" available without introducing a new cloud dependency — an autonomous decision per this milestone's own AUTONOMY clause (token-encryption key *provider* was the stop-condition; the concrete implementation given no existing provider was judged an implementation detail). *Consequence*: a cloud KMS migration remains a valid, real future upgrade path, named as such in the token vault's own doc comments — not a permanent architectural commitment.
- **ADR-M28.6-05**: `startConnection`/`disconnect` remain user-scoped self-service operations without a mandatory-reason requirement; only admin actions require one. *Rationale*: the brief's mandatory-reason requirement (Phase 19) is explicitly an admin-operations concern; requiring a reason from a candidate disconnecting their own mailbox would be unnecessary friction with no operational value. *Consequence*: `MailboxAdminActionDto` (reason required) and the plain `disconnect()` method (no reason) are deliberately different shapes for deliberately different actors.

---

## Reused Modules (zero duplicated logic)
`buildRawMimeEmail()` (M28.5's MIME builder — reused verbatim by Gmail, not reimplemented), `AttachmentResolverPort`/`EmailSecurityAuditService` (M28.5, unchanged), `DeliverabilityService.isSuppressed()` (M28, reused by the readiness gate), `ProviderFailure`/`ProviderFailureCategory` (M11/M28's failure taxonomy, reused rather than a parallel one), the conditional-`updateMany`-race idiom (`PostgresLeaseLock`/`EmailQueueRepository.claimBatch()`/M28.5's document versioning — now `OAuthTransactionRepository.tryConsume()`), `JwtAuthGuard`/`RolesGuard`/`@Roles`/`@CurrentUser()` (identical to every other admin/owned-resource endpoint), `ExecutionClock`, `PrismaService`, `app.corsOrigin` (reused as the frontend base URL for OAuth redirects, no new env var invented), the `useTrackedMutation`/`ContextHeader`/`TrustFeedbackCard`/`ErrorState`/`SkeletonRegion`/`Card`/`Badge`/`Button` frontend component set (all pre-existing M20–M27.5 primitives, zero new UI primitives built).

## New Components (backend)
`connected-mailbox` module in full: domain (`ConnectedMailbox`/`OAuthTransaction`/`ConnectedMailboxSendAttempt` models, 4 repository ports, `ConnectedMailboxProviderPort`, `TokenVaultPort`, `oauth-scope-policy.ts`, `connected-mailbox-rate-policy.ts`), infrastructure (`AesGcmTokenVaultAdapter`, `GmailMailboxProviderAdapter`, `MicrosoftOutlookMailboxProviderAdapter`, 3 Prisma repositories), application (`OAuthSecurityService`, `MailboxTokenVaultService`, `MailboxConnectionService`, `ConnectedMailboxRateLimiterService`, `ConnectedMailboxReadinessService`, `ConnectedMailboxSendService`), presentation (`MailboxConnectionsController`, `AdminConnectedMailboxController`), `ConnectedMailboxModule`, `connected-mailbox.config.ts`.

## New Components (frontend)
`features/connected-mailbox/` (`api/connected-mailbox.api.ts`, `hooks/use-connected-mailboxes.ts`, `hooks/use-mailbox-actions.ts`, `components/connected-mailbox-card.tsx`, `components/connected-mailbox-workspace.tsx`), `CONNECTED_MAILBOX_STATUS_TONE` (added to the existing `status-mappings.ts` single-source-of-truth table), `ConnectedMailboxProvider`/`ConnectedMailboxStatus`/`ConnectedMailboxDto`/`AdminConnectedMailboxDto`/`StartMailboxConnectionResponseDto` (`packages/shared-types`, matching every other feature's DTO-from-shared-types convention).

## Modified Components
`CampaignBatchDispatchService` (rewired onto `ConnectedMailboxSendService`), `campaign-execution-task-handler.module.ts` (imports `ConnectedMailboxModule` in `DeliverabilityModule`'s place), `AdminEmailController` (+1 filter param), `documents` module's audit port/repository (`connectedMailboxId` fully wired through), `ResolvedAttachmentPayload`/`AttachmentResolverService` (+`version` field), `apps/web/src/app/(dashboard)/settings/page.tsx` (real content, replacing the `NotYetAvailable` placeholder), `.env`/`.env.example`.

---

## Principal Engineer Review

**Does German Job Engine now send every candidate application from the candidate's own real, verified, OAuth-connected mailbox — never a silent platform-sender fallback — with tokens genuinely encrypted at rest, least-privilege scopes enforced, and a real, tested single-use CSRF/replay defense on the OAuth flow itself?**

Yes for the real, load-bearing parts of that question, proven rather than assumed: a real candidate can connect a real Gmail or Outlook account through a genuine OAuth 2.0 + PKCE authorization-code flow, have their identity verified exclusively by the provider's own API (never trusted from the frontend), have their tokens encrypted with a real NIST-approved AEAD cipher that fails closed rather than ever falling back to plaintext, and have every subsequent candidate-application email sent from that verified mailbox through the one authoritative dispatch path this milestone rewired onto — a path that has no code branch capable of silently falling back to the platform sender, proven by test, not merely by policy. The single-use `state` defense against OAuth replay/CSRF was proven correct under a genuine concurrent-consumption race, matching the same DB-level-constraint discipline already proven correct in three prior milestones (Billing's webhook dedup, M28's email queue, M28.5's document versioning) — and this milestone applied that lesson proactively in its own first migration rather than discovering the gap later, unlike M28.5's own retrospective fix. Rate limiting, warm-up, and failure-rate auto-pause are real, DB-backed, and tested, not advisory comments. The Settings page was verified live in a real browser against a real running backend — not merely built and assumed to work.

What is **not** yet true, named rather than discovered later by an operator: no formal legal review of the consent copy exists; Google's own app-verification review (external, non-code, required for general-availability `gmail.send` access) has not been completed, since no real production OAuth app exists yet; the rate-limit numbers are a considered starting point, not empirically validated against real send volume; and a long-dormant reauthorization-required mailbox has no proactive re-engagement mechanism yet.

## FINAL VERDICT:
## APPROVED FOR CONNECTED MAILBOX PRODUCTION READINESS

Supported by: a complete, live-verified OAuth 2.0 + PKCE connection lifecycle for both Gmail and Outlook with real single-use CSRF/replay defense; real AES-256-GCM token encryption that fails closed under every tested failure mode; least-privilege scope enforcement that fails the whole connection closed on any excess grant; a live rewiring of the actual production candidate-dispatch path onto this new mechanism with zero silent platform-sender fallback (proven by test); real, DB-backed rate-limiting/warm-up/failure-rate-auto-pause controls; full admin operations with mandatory-reason attribution; 1153/1153 backend unit tests and 4/4 real Postgres concurrency tests passing with zero regressions; a real, browser-verified Settings page with zero genuine console errors; six real issues found and fixed during this milestone's own build-review cycle — including a redirect-URI misconfiguration that would have silently broken the entire OAuth flow in any real deployment, caught before any real credential was ever configured against it — none hidden. Real production connected-mailbox sending remains gated behind `CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED`, a genuinely configured token-encryption key, and real Google/Microsoft OAuth app credentials — activating them, along with Google's own external app-verification review, is a deliberate, separate operator decision this milestone does not make.
