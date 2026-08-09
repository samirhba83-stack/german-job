# Milestone 31.2 Phases 9/13 — Google Cloud & Microsoft Entra Test Project External Actions

Both blocks below are independent of each other and of doc 37's Render provisioning — the Product
Owner can act on any of the 3 in parallel. Google/Microsoft OAuth redirect URIs need the real
Staging URL from doc 37 to be final, but the account/project creation itself does not.

## EXTERNAL ACTION REQUIRED — GOOGLE CLOUD

**Provider:**
Google Cloud

**Purpose:**
Create the dedicated test project real Gmail OAuth/send/webhook certification (Phases 10-12)
depends on — this codebase's own OAuth+PKCE+token-vault code (doc 32, re-verified complete) has
never been exercised against real Google infrastructure.

**Exact Product Owner action** (per Google's current documentation at the time this is executed —
verify the exact console flow hasn't changed, since Google's own UI shifts over time):
1. Create a new, dedicated Google Cloud project (e.g. `german-job-engine-staging`) — separate from
   any future Production project (doc 02's own non-negotiable separation contract).
2. Enable the **Gmail API** for that project (APIs & Services → Library → Gmail API → Enable).
3. Configure the **OAuth consent screen** (APIs & Services → OAuth consent screen): External user
   type (or Internal if a Google Workspace is available), app name "German Job Engine (Staging)",
   support email, developer contact.
4. Add **Test Users**: real Google accounts created specifically for this certification — never a
   real candidate's personal account, never a real company's account. At minimum 2 (one to act as
   the "candidate" connecting their mailbox, one to act as the "approved test recipient" replying).
5. Under **Scopes**, request only what this codebase already implements: the Gmail send scope
   (sending capability) and `gmail.readonly` (the separate M29 inbox-reading consent upgrade) —
   doc 32 already confirms the code never requests broader scopes.
6. Create an **OAuth 2.0 Client ID** (APIs & Services → Credentials → Create Credentials → OAuth
   client ID → Web application). Add the authorized redirect URI:
   `https://gje-staging-api.onrender.com/mailbox-connections/callback/google` (matches
   `render.yaml`'s own `GOOGLE_OAUTH_REDIRECT_URI` exactly — must be byte-identical).
7. Set up **Pub/Sub** for Gmail push notifications: create a topic (e.g.
   `gmail-staging-notifications`), grant `gmail-api-push@system.gserviceaccount.com` publish
   rights on it (Google's own documented requirement for Gmail watch notifications), then create a
   push subscription pointing at `https://gje-staging-api.onrender.com/inbox-webhooks/gmail`.

**Data or value Claude needs afterward:**
- The OAuth Client ID and Client Secret (set directly into Render's dashboard as
  `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET` — `sync: false` in `render.yaml`, never
  pasted into chat).
- The Pub/Sub topic name (`GOOGLE_INBOX_PUBSUB_TOPIC`).
- A push-authentication token you generate yourself (any long random string) set as both the
  Pub/Sub push subscription's own authentication token AND `GOOGLE_INBOX_PUSH_AUTH_AUDIENCE` in
  Render — this is a value only you need to know; Claude does not need to see it to configure the
  application side (the config key name is enough).
- Confirmation that Test Users were added and which 2 accounts they are (email addresses only —
  not passwords).

**What NOT to share:**
The OAuth Client Secret, the Pub/Sub push-authentication token, or any Test User account password.

**Independent work already completed:**
The full 12-step Gmail test flow (doc 07), the OAuth/PKCE/token-vault code (doc 32), and the
webhook controller + its now-real test coverage (doc 32) — all ready to execute the moment this
project exists and its credentials are set in Render.

**Next automatic step after completion:**
Run the real 12-step flow (doc 07) against the live Staging URL using the 2 real Test User
accounts — this is doc 42 (Real Gmail OAuth & Send Certification).

---

## EXTERNAL ACTION REQUIRED — MICROSOFT ENTRA

**Provider:**
Microsoft Entra (Azure AD)

**Purpose:**
Create the dedicated test app registration real Outlook OAuth/send/webhook certification
(Phase 14) depends on.

**Exact Product Owner action** (per Microsoft's current documentation at execution time):
1. In the Azure Portal, register a new application (Entra ID → App registrations → New
   registration) — name it e.g. "German Job Engine (Staging)". Supported account types:
   "Accounts in any organizational directory and personal Microsoft accounts" (matches this
   codebase's existing `tenant: 'common'` default, doc 32).
2. Add a **Redirect URI** (Web platform):
   `https://gje-staging-api.onrender.com/mailbox-connections/callback/microsoft` (byte-identical
   to `render.yaml`'s `MICROSOFT_OAUTH_REDIRECT_URI`).
3. Under **API permissions**, add only what this codebase already implements: `Mail.Send` and the
   narrower inbox-reading Graph permission already used for the M29 consent upgrade, plus
   `offline_access` (required for refresh tokens — Graph access tokens are short-lived).
4. Create a **client secret** (Certificates & secrets → New client secret) — note its real expiry
   date; a client secret needs a real rotation runbook (doc 31 already flags this as a known gap
   worth closing before this expires, not before Staging certification itself).
5. Use a dedicated test Outlook/Microsoft account (personal Microsoft account or a work/school
   account in a dedicated test tenant) — never a real candidate's personal account.
6. Note: the Graph subscription (webhook) itself is created by this application's own code at
   mailbox-connection time, not manually in the Azure Portal — no separate webhook-registration
   step is needed here beyond having the redirect URI and permissions correct.

**Data or value Claude needs afterward:**
- The Application (client) ID and client secret (set directly into Render as
  `MICROSOFT_OAUTH_CLIENT_ID`/`MICROSOFT_OAUTH_CLIENT_SECRET`).
- A `clientState` value you generate yourself (any long random string) set as
  `MICROSOFT_INBOX_WEBHOOK_CLIENT_STATE` in Render.
- The test Outlook account's email address (not its password).

**What NOT to share:**
The client secret, the `clientState` value, or the test account password.

**Independent work already completed:**
The full 13-step Outlook test flow (doc 08), the OAuth/token-vault code (doc 32), and — a real,
already-written regression test (doc 32) for the exact process-crash bug (M29 Finding #1,
`@Res()` passthrough) this new real webhook traffic would otherwise risk re-triggering if it had
ever regressed.

**Next automatic step after completion:**
Run the real 13-step flow (doc 08) against the live Staging URL — this is doc 43 (Real Outlook
OAuth & Send Certification).
