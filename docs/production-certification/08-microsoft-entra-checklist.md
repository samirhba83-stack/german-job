# Milestone 31 Phase 10 — Microsoft Entra Certification Checklist

**Status: prepared, not executed.** Real testing against a real Outlook account requires a real
Microsoft Entra tenant/app registration — creating one is on this milestone's own explicit
AUTONOMY stop-list. This document is the complete, ready-to-execute checklist; nothing below has
been performed against real Microsoft infrastructure.

## What this codebase already implements (real, built in M28.6/M29, re-confirmed this pass)

- OAuth 2.0 Authorization Code + PKCE via Microsoft Graph, `tenant: 'common'` by default (accepts
  both personal Microsoft accounts and work/school accounts — a real production Entra app
  registration may narrow this per the operator's own tenancy decision)
- Same envelope-encrypted token vault as Gmail (shared implementation)
- Minimum permissions scoped narrowly and separately per capability: `Mail.Send` for sending,
  a real, narrower inbox-reading permission for the separate M29 consent upgrade (never full
  `Mail.ReadWrite`)
- `offline_access` requested (required for refresh tokens — Graph access tokens are short-lived)
- Real Graph subscription creation + renewal (Graph mail subscriptions expire ~3 days — the
  shortest of the two providers, so `InboxWatchRenewalTickDriverService`'s tick interval must stay
  well under that horizon)
- Real webhook validation handshake — the exact real bug M29 found and fixed live (`@Res()`
  passthrough footgun that crashed the whole process on Graph's real subscription-validation
  request) — see `docs/inbox-intelligence/threat-model.md` Finding #1
- Real `clientState` shared-secret verification, `timingSafeEqual` (hardened during M29)

## Microsoft Entra setup checklist (to be executed once a Product Owner approves tenant/app creation)

- [ ] Register a dedicated Entra application for **Staging**
- [ ] Register a SEPARATE Entra application for **Production**
- [ ] Configure redirect URIs matching `MICROSOFT_OAUTH_REDIRECT_URI` per environment
- [ ] Request only `Mail.Send` + the real inbox-reading permission already implemented — no
      broader Graph permissions
- [ ] Configure `offline_access` in the requested scopes
- [ ] Create a client secret (or, preferably for a real production app, a certificate — a secret
      needs a real rotation runbook, matching Phase 7's own currently-open item) — store in the
      chosen secret manager, never in Git
- [ ] Add explicit Test Users — real Microsoft accounts (personal or a dedicated test tenant's
      work/school accounts) created specifically for this certification
- [ ] Write the real scope-justification text for admin/user consent screens
- [ ] Configure the Graph subscription creation flow to point at
      `https://webhooks-staging.<approved-domain>/inbox-webhooks/microsoft`
- [ ] Set `MICROSOFT_INBOX_WEBHOOK_URL` / `MICROSOFT_INBOX_WEBHOOK_CLIENT_STATE` for Staging
- [ ] Confirm the webhook URL is real HTTPS (Graph rejects a validation handshake over HTTP —
      documented in `docs/inbox-intelligence/production-safety-gates.md`)

## The real 13-step test flow (from the brief, ready to execute once the above exists)

1. Connect mailbox (real Test Outlook account, Staging environment)
2. Verify identity (confirm the connected email address matches the Test account)
3. Send a synthetic application (real send, to an Approved Test Recipient only)
4. Confirm the message appears in the Test account's own Sent folder
5. Receive a synthetic reply (from the Approved Test Recipient)
6. Confirm a real Graph change notification arrives at the Staging webhook endpoint
7. Validate `clientState` matches on the real inbound notification
8. Confirm the reply correlates to the real application/campaign
9. Confirm real rule-based classification produces a real category + confidence
10. Confirm a real `ApplicationFollowUpControl` is created where warranted (M30)
11. Confirm a real `RecruitmentActionTask` is created where warranted (M30)
12. Disconnect access — confirm via the API
13. Confirm no further inbox processing occurs after disconnect

## Explicitly NOT done as part of this milestone

- Any formal Microsoft app-verification/publisher-verification submission
- Using any real candidate's personal Microsoft account
- Connecting to or reading any real company's real inbox
