# Milestone 31.1 Phases 6-10 — Google/Microsoft OAuth & Webhook Readiness Re-Verification

Real execution against real Google/Microsoft infrastructure remains **BLOCKED_EXTERNAL** — creating
a real Google Cloud test project or Microsoft Entra tenant/app registration is explicitly on this
milestone's own AUTONOMY stop-list (§Phase 6/8's own "Yes — Google Cloud project creation"/"Yes —
Entra tenant/app creation" in doc 29's blocker matrix). What this phase does instead: re-verify, by
reading the actual current code (not re-trusting doc 07/08/09's own prior claims blindly), that
every "Verify explicitly" item those docs list is real and present — so that once the Product Owner
decision lands, execution is truly just "run the already-ready 12/13-step flow," not "discover
mid-flow that something was assumed but never built."

## Re-verified this phase, by direct code inspection

| Requirement | Verified in | Real? |
|---|---|---|
| Exact requested scopes, least privilege | `gmail-mailbox-provider.adapter.ts` / `microsoft-outlook-mailbox-provider.adapter.ts` — send-only scope for the base connection, a separate narrower read-only scope only requested on the distinct M29 inbox-consent upgrade | ✅ Confirmed unchanged from doc 07/08's own claim |
| PKCE (code verifier/challenge) | `mailbox-connection.service.ts` — `codeVerifier` generated and stored on `OAuthTransaction` at `startConnection()`, checked at callback | ✅ Real |
| State parameter, replay rejection | `OAuthTransaction` — `state` is single-use (consumed at callback), time-bound (`expiresAt`), and `OAuthSecurityService` owns the verification | ✅ Real |
| Backend callback derives identity exclusively server-side | `mailbox-connection.service.ts`'s own doc comment: "the user is derived exclusively from the looked-up `OAuthTransaction.userId`, recorded at start" — never trusts a client-supplied user id at callback time | ✅ Real |
| Encrypted token persistence | AES-256-GCM envelope encryption, versioned (`tokenEncryptionVersion`) — `aes-gcm-token-vault.adapter.ts` | ✅ Real |
| Refresh behavior | Real refresh-token exchange path exists per provider adapter, unit-tested (`refreshAccessToken` mocked/asserted in both adapter spec files) | ✅ Real (never exercised against a real provider) |
| Revocation / disconnect | `disconnect(userId, mailboxId)` — explicit `if (mailbox.userId !== userId)` ownership check before any disconnect action | ✅ Real |
| Reconnect | `findActiveByUserId` + "switched their active connected mailbox" log path — a user reconnecting deactivates the prior mailbox atomically, never leaves two simultaneously active (DB-level partial unique index, established M28.6) | ✅ Real |
| Token expiration handling | `accessTokenExpiresAt` tracked per mailbox; readiness checks account for it | ✅ Real |
| Account mismatch (connecting a different account than expected) | `MAILBOX_IDENTITY_VERIFIED` audit step — identity is verified against the provider's own response, not assumed from the request | ✅ Real |
| Redirect URI fixed, non-dynamic | `GOOGLE_OAUTH_REDIRECT_URI`/`MICROSOFT_OAUTH_REDIRECT_URI` — single, server-configured value each, no dynamic redirect list to misconfigure | ✅ Real |
| Cross-user isolation | Ownership check on every mutating action (`disconnect`, and by extension `force-reauthorization`/`suspend` at the admin layer, doc 22) | ✅ Real |

**Nothing above required a code change this phase** — everything doc 07/08 previously claimed was
real and complete is still real and complete, confirmed by re-reading the current source rather
than trusting the prior claim uncritically (the same discipline that caught the real gap in Phase
2's archive-authorization review).

**A real, different gap was found and closed**: `EmailWebhookProcessingService` (the intake for
Resend/SendGrid/SES) and both inbox webhook controllers (Gmail, Microsoft Graph) had **zero**
dedicated unit tests — including for the `PRODUCTION_WEBHOOK_PROCESSING_ENABLED` gate itself,
added earlier in M31 but never verified by a test. 16 new tests added across 3 new spec files,
covering: the disabled-vs-enabled processing gate (authenticate+audit always happens; mutation
only when enabled), signature rejection, duplicate detection, unknown-message/unknown-mailbox
handling, and — a real regression test for M29's own previously-found process-crash bug (the
`@Res()` passthrough footgun on Microsoft Graph's validation handshake) — confirming that exact
request shape no longer throws. All 16 pass; full suite re-confirmed clean afterward.

## Phase 7/9 — Webhook readiness

No code change from doc 09's own status. Re-confirmed the specific concern this milestone names —
"the previously-fixed Graph webhook crash behavior must receive a regression test under the real
public endpoint" — is *possible* to exercise once Staging exists: the fix itself
(`microsoft-graph-inbox-webhook.controller.ts`'s `@Res()` passthrough without `passthrough: true`)
has a real, passing unit-adjacent test today (its own controller behavior is exercised in the
module's test suite); the "under the real public endpoint" half of that requirement is exactly
what's blocked on Staging existing (doc 29 blocker #7).

## What remains BLOCKED_EXTERNAL

Every item in doc 29's blocker matrix rows 4–7. **EXTERNAL ACTION REQUIRED**, per the brief's own
required framing:

> A real Google Cloud test project and a real Microsoft Entra app registration must be created by
> the Product Owner (doc 03/doc 30's own AUTONOMY stop-list entries) before Phases 6–9's real test
> flows can execute. The complete, step-by-step checklists (doc 07/08) and the complete 12-step/
> 13-step test flows are ready to run the moment those exist — no further preparation is possible
> without them.

All independent work possible without those two accounts is complete as of this document.
