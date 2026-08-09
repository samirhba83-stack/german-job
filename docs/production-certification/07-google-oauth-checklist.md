# Milestone 31 Phase 9 — Google Cloud OAuth Certification Checklist

**Status: prepared, not executed.** Real testing against a real Gmail account requires a real
Google Cloud project — creating one "باسم المالك" (in the owner's name) is on this milestone's own
explicit AUTONOMY stop-list. This document is the complete, ready-to-execute checklist; nothing
below has been performed against real Google infrastructure.

## What this codebase already implements (real, built in M28.6/M29, re-confirmed this pass)

- OAuth 2.0 Authorization Code + PKCE (`connected-mailbox/application/services/mailbox-connection.service.ts`)
- Real AES-256-GCM envelope-encrypted token vault, versioned (`tokenEncryption.key`/`keyVersion`)
- A single, fixed, server-configured redirect URI (`GOOGLE_OAUTH_REDIRECT_URI`) — no dynamic
  redirect list to misconfigure
- Minimum scopes already scoped narrowly and separately per capability:
  - Sending capability: Gmail send-only scope
  - Inbox-reading capability (M29, separate consent upgrade): `gmail.readonly` only — never
    `gmail.modify`, never full mailbox access
- Real Gmail Pub/Sub watch registration + renewal (`InboxWatchRenewalTickDriverService`, expires
  ~7 days, renewed on a real tick)
- Real webhook signature/audience verification (`GOOGLE_INBOX_PUSH_AUTH_AUDIENCE`,
  `timingSafeEqual` comparison, hardened during M29's own security pass)
- Real inbox-disconnect path that stops future reading without touching send-capable tokens (M29
  Non-Negotiable Principle #15, live-verified during M29)

## Google Cloud setup checklist (to be executed once a Product Owner approves project creation)

- [ ] Create a dedicated Google Cloud Project for **Staging** (separate from Production — Phase 2)
- [ ] Create a SEPARATE Google Cloud Project for **Production** (never share OAuth client
      credentials between environments)
- [ ] Enable the Gmail API on both projects
- [ ] Configure the OAuth consent screen: application name, logo, support email, developer contact
- [ ] Add Privacy Policy URL and Terms URL (see Phase 19 — technical draft ready, needs real legal
      review before this step)
- [ ] Register the approved redirect URI(s) — exactly one per environment, matching
      `GOOGLE_OAUTH_REDIRECT_URI` (`https://api-staging.<approved-domain>/mailbox-connections/
      callback/google` and the Production equivalent once the domain is chosen — Phase 8)
- [ ] Add explicit Test Users (Staging project) — real Google accounts created specifically for
      this certification, never a real candidate's personal account
- [ ] Request only the scopes already implemented: Gmail send + `gmail.readonly` — do not request
      broader scopes "just in case"
- [ ] Write the real scope-justification text Google's consent-screen review requires for each
      scope (why this app needs it) — a real requirement before Google will grant anything beyond
      the lowest "unverified app" tier
- [ ] Configure Pub/Sub: create a topic, grant `gmail-api-push@system.gserviceaccount.com` publish
      rights (Google's own documented requirement), create the push subscription pointing at
      `https://webhooks-staging.<approved-domain>/inbox-webhooks/gmail`
- [ ] Set `GOOGLE_INBOX_PUBSUB_TOPIC` / `GOOGLE_INBOX_PUSH_AUTH_AUDIENCE` for Staging

## The real 12-step test flow (from the brief, ready to execute once the above exists)

1. Connect mailbox (real Test Gmail account, Staging environment)
2. Verify identity (confirm the connected email address matches the Test account)
3. Send a synthetic application (a real send, to an Approved Test Recipient only — never a real
   company)
4. Verify the message appears in the Test account's own Sent folder
5. Receive a synthetic reply (sent FROM the Approved Test Recipient TO the Test account)
6. Confirm a real Gmail Pub/Sub push notification arrives at the Staging webhook endpoint
7. Confirm the reply correlates to the real application/campaign
   (`ConnectedMailboxSendAttempt`-based correlation, M29)
8. Confirm real rule-based classification produces a real category + confidence
9. Confirm a real `RecruitmentActionTask` is created (M30) where the classification warrants one
10. Confirm a real `ApplicationFollowUpControl` suppresses further follow-up where warranted (M30)
11. Disconnect inbox access (keep send access) — confirm via the API that
    `inboxCapabilityStatus` changes and send-related fields are untouched
12. Confirm no further inbox reading occurs after disconnect (poll/watch stop; a new synthetic
    reply sent after this point produces no new `InboxMessage` row)

## Explicitly NOT done as part of this milestone

- Submitting Google's formal "unverified app" → verified app review (requires real legal/business
  information, potentially a security assessment fee, and Product Owner-level attestations — an
  explicit AUTONOMY stop-condition: "لا تطلب Google Production Verification آليًا")
- Using any real candidate's personal Google account
- Connecting to or reading any real company's real inbox
