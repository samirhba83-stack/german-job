# Milestone 31 Phase 21 — Beta Onboarding Flow

Real backend support for onboarding a Closed Beta user, built and live-verified this phase. Not a
wizard UI (that's explicitly frontend page-implementation scope this milestone doesn't build, same
boundary `docs/interaction-framework/14-risks-and-future-expansion.md` already drew for the
Onboarding Wizard in general) — this phase builds the thing a wizard would need to be honest:
a real status API with no fabricated progress.

## 1. What a Closed Beta user's real path looks like today

1. **Invitation** — an admin issues an email-bound invitation (`POST /admin/beta-access/invitations`,
   Phase 20). Delivery is manual today (no invitation email is sent by the system — see §4).
2. **Registration** — `POST /auth/register` with the invitation code. Real, live, browser-verified
   (Phase 20 §5).
3. **Login** — real, pre-existing (M20).
4. **Profile** — `POST /profiles`, `PATCH /profiles/me`, CV/photo upload metadata endpoints — real,
   pre-existing (M20/M24).
5. **Connect a mailbox** (optional, gated) — `POST /mailbox-connections/:provider/start` — real
   code path, but **not usable in any environment today**: no real Google/Microsoft OAuth
   credentials exist anywhere yet (Phase 9/10 are prepared checklists, not completed
   certifications). This is the single largest gap between "the code is real" and "the feature is
   usable" in the entire onboarding path.
6. **Create a campaign** — `POST /campaigns` + targets — real, pre-existing (M25/M26).
7. **Everything downstream** (execution, sending, inbox intelligence, recruitment operations) is
   real and already certified in M26–M30, but is gated behind the same production-safety flags
   this whole certification effort is about — see doc 18 (Staged Activation Plan).

## 2. What was built this phase

`GET /onboarding/status` (`OnboardingModule`, `apps/api/src/modules/onboarding/`) — a real,
live, authenticated endpoint reporting the current user's true state across 4 steps: account,
profile, mailbox connection, first campaign. Pure read-side aggregation over 4 existing bounded
contexts (users/profiles/connected-mailbox/campaigns) — no new persistence, same architectural
shape as `application-assembly`'s own cross-context service.

Each step reports one of **three** states, deliberately not two:

- `complete` — really done, verified against real persisted state.
- `incomplete` — not done yet, but the user genuinely can do it right now.
- `unavailable` — cannot be completed in this deployment at all (currently only the mailbox step,
  because no real OAuth credentials are configured anywhere). Collapsing this into `incomplete`
  would tell a beta user to go do something that will fail — exactly the "hide a failure" pattern
  Non-Negotiable Principle #16 forbids.

The response also carries a fixed `productionSafetyNotice` string restating the one rule every
beta user needs to see before they act: nothing is ever sent to a real company without separate
Product Owner approval. Live response evidence (real admin test account, freshly created, nothing
set up yet):

```json
{
  "steps": [
    { "id": "account", "state": "complete" },
    { "id": "profile", "state": "incomplete", "detail": "Create your candidate profile to get started." },
    { "id": "connect-mailbox", "state": "unavailable", "detail": "Mailbox connection is not available in this environment yet — real Google/Microsoft OAuth credentials have not been configured..." },
    { "id": "campaign", "state": "incomplete", "detail": "Create a campaign to start defining what roles and companies you want to target." }
  ],
  "profileCompletionPercentage": 0
}
```

Verified across profile-partial (80%), profile-complete (100%), mailbox-configured-not-connected,
mailbox-connected, and campaign-exists variants via a real unit spec
(`onboarding-status.service.spec.ts`, 8 cases) plus the live curl call above against a genuinely
fresh server process.

## 3. What is explicitly NOT built this phase, and why

- **No onboarding wizard UI.** The frontend `apps/frontend-architecture` blueprint already scoped
  this as a future page-implementation milestone; retrofitting a full multi-step wizard component
  under an already-enormous certification milestone would be scope creep this milestone's own
  "not full feature expansion" instruction rules out. The one frontend gap that WAS in scope —
  registration itself being unusable without an invitation-code field — was fixed (Phase 20 §6),
  because without it nobody could onboard at all, closed-beta-status page or not.
- **No invitation email delivery.** `BetaInvitationService.invite()` creates the real record and
  returns the real code in the API response; nothing emails it to the invitee. For a small,
  team-operated Closed Beta this is an acceptable manual step (the admin copies the code out of
  the API response or `GET /admin/beta-access/invitations` and sends it directly) — automating it
  would mean standing up outbound transactional email for account-management mail specifically,
  which is a real but separate piece of work from anything else this certification touches.
- **No progress persistence beyond what other modules already own.** There is no separate
  "onboarding completed" flag anywhere — status is always computed live from real state, so it can
  never drift out of sync with reality (a stored, cached "onboarding complete" boolean is exactly
  the kind of thing that silently goes stale).

## 4. Honest assessment against the milestone's "no fake progress" instruction

Every value `GET /onboarding/status` returns is a live read of a real column or a real query
result at request time — `profileCompletionPercentage` is `UserProfile.calculateCompletionPercentage()`,
a pre-existing (M20), tested domain method, not something invented for this report. The mailbox
step's `unavailable` state is derived from the exact same config keys
(`connectedMailbox.google.clientId`/`microsoft.clientId`/`tokenEncryption.key`) that already
determine whether the OAuth start endpoint itself would work — there is no separate, driftable copy
of that logic.
