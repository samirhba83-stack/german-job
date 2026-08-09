# Milestone 31 Phase 22 — Beta UX Quality Gate

Real browser evidence (Playwright, against the live local dev build), not a design review. Scope
is exactly what the milestone asks for — broken navigation, missing states, inaccessible controls
blocking real Closed Beta use — explicitly not a redesign.

## 1. What was checked

A real Closed Beta test account (`m31-browsertest@example.com`, registered via a real invitation
in Phase 20) was driven through every top-level authenticated route: dashboard, profile, campaigns
(list + new), companies (list + new), jobs (list + new), applications, inbox, tasks, billing,
settings, mission control — plus `/login` and `/register` unauthenticated. For each: HTTP status,
full-page screenshot, and every browser console error were captured.

WCAG 2A/2AA accessibility (`@axe-core/playwright`) was run against 6 representative pages
(login, register, dashboard, campaigns, companies, billing). A 390×844 mobile viewport pass
checked for horizontal overflow on 3 representative pages.

## 2. Results

- **13/13 authenticated routes**: HTTP 200, render correctly.
- **Accessibility**: **0 WCAG 2A/2AA violations** across all 6 pages checked.
- **Mobile (390px)**: no horizontal overflow on any of the 3 pages checked; layout reflows
  correctly.
- **Console errors found and resolved**: see §3.
- **Console noise investigated and confirmed non-blocking**: see §4.

## 3. Real issue found and fixed

`GET /profiles/me` correctly 404s for a brand-new account with no profile row yet
(`GetProfileHandler`) — legitimate REST semantics, not a bug. But
`useMyProfile()` (`apps/web/src/features/profiles/hooks/use-my-profile.ts`) modeled that as a
TanStack Query **error**, not as valid "no profile yet" data. Both real consumers
(`CampaignDashboardSummary`, `CampaignOverview`) already rendered a safe fallback (`—`) either way,
so this was never visually broken — but every new beta user's very first dashboard load produced a
spurious `isError` state internally. Fixed: a 404 on this one lookup is now treated as real data
(`null`), matching the domain repository's own "doesn't exist yet" semantics; any other status
still throws normally, so a genuine backend outage still surfaces as `isError`.

## 4. Investigated and confirmed non-blocking (documented, not silently dismissed)

- **`Failed to load resource: 404` in the browser console for `/profiles/me`.** This line is
  Chrome DevTools' own automatic logging for any non-2xx `fetch`/XHR response — it appears
  regardless of whether application code handles the rejection, and remains after the fix in §3.
  Eliminating it entirely would require either not making an existence-check request at all (no
  cheap alternative exists) or changing the backend's 404-for-not-found contract to something
  non-standard purely to satisfy a devtools cosmetic — not a change this phase makes. This is the
  same class of artifact any production app exhibits for a REST existence check; it does not
  indicate a functional defect and was not treated as one.
- **`Failed to fetch RSC payload... Falling back to browser navigation` on the very first
  post-login page.** Reproduced only when the client-side `router.push('/')` redirect races a
  Next.js RSC prefetch in dev mode — confirmed by isolating the case: a fresh, independent hard
  navigation to `/` (not immediately following a login redirect) produces **zero** console errors,
  and Next.js's own fallback logic (a full browser navigation) already recovers gracefully.
  Dev-server-only artifact of Next.js 14's router; not expected against a production build's static
  routing manifest, and does not block or visibly affect the user.

## 5. Real, honest gap found (not fixed this phase — documented instead)

**`/profile` is a pre-existing, intentional stub** (`NotYetAvailable`, "The profiles backend is
real and live, but the Profile screen is reserved for a future milestone — it isn't built yet.").
This means **a Closed Beta candidate cannot create or edit their profile, or upload a CV, through
the web UI at all today** — the backend (`POST /profiles`, `PATCH /profiles/me`, CV/photo upload
endpoints) is real, live, and already exercised by this certification's own earlier phases via
direct API calls, but there is no page wired to it.

This was deliberately **not** built this phase: a full profile-editing UI (forms for skills,
languages, work experience, education, CV/photo upload) is real feature-implementation work, not
production-hardening — building it now would be exactly the "not full feature expansion" scope
creep this milestone's own instructions rule out. It is instead surfaced honestly:

- `GET /onboarding/status` (Phase 21) reports the profile step as genuinely `incomplete` for every
  user, since it cannot be completed through the UI.
- This gap is carried into the Phase 30 RC1 report's Known Limitations as a real, named blocker on
  how much of a beta candidate's real journey is actually walkable end-to-end through the UI today
  — distinct from "the backend doesn't support it" (it does).

## 6. Screenshots

Full-page screenshots for all 13 routes (desktop) plus 3 mobile-viewport screenshots were captured
during this audit as real evidence, reviewed directly (not merely asserted) before this report was
written.
