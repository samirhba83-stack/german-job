# 9. Navigation Architecture

## Route tree

Built on Next.js App Router route groups — extending the scaffold's existing `(auth)`/`(dashboard)` split rather than introducing a new routing paradigm.

```
app/
├── (public)/                      # no auth required, public layout (marketing header/footer)
│   ├── page.tsx                   # Landing
│   ├── companies/
│   │   ├── page.tsx                # Company Explorer (public)
│   │   └── [id]/page.tsx           # Company Detail (public)
│   └── jobs/
│       ├── page.tsx                # Job Listings (public)
│       └── [id]/page.tsx           # Job Detail (public)
│
├── (auth)/                        # no auth required, minimal layout — already scaffolded
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── verify-email/page.tsx      # ⚪ reserved, redirects immediately — see 03
│   └── forgot-password/page.tsx   # ⚪ reserved
│
├── onboarding/page.tsx            # authenticated, no shell (full-screen wizard)
│
├── (dashboard)/                   # authenticated, full app shell — already scaffolded
│   ├── layout.tsx
│   ├── page.tsx                    # Dashboard Home
│   ├── profile/
│   │   ├── page.tsx                 # Profile Overview
│   │   ├── edit/page.tsx
│   │   └── cv/page.tsx
│   ├── campaigns/
│   │   ├── page.tsx                 # Campaign List — already scaffolded (empty)
│   │   ├── new/page.tsx
│   │   └── [id]/
│   │       ├── page.tsx             # Overview tab
│   │       ├── timeline/page.tsx
│   │       ├── health/page.tsx
│   │       ├── execution/page.tsx
│   │       └── edit/page.tsx
│   ├── applications/
│   │   ├── page.tsx                 # already scaffolded (empty)
│   │   └── [id]/
│   │       ├── page.tsx
│   │       ├── timeline/page.tsx
│   │       └── history/page.tsx
│   ├── companies/                  # employer-side "my companies"
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [id]/edit/page.tsx
│   ├── jobs/                       # employer-side "my jobs"
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [id]/edit/page.tsx
│   ├── mission-control/            # 🟡 reserved
│   │   └── page.tsx
│   ├── trust-center/[id]/page.tsx  # 🟡 reserved
│   ├── billing/page.tsx            # already scaffolded (empty)
│   ├── settings/page.tsx
│   └── admin/page.tsx              # ⚪ reserved, ADMIN-gated
│
├── unauthorized/page.tsx
├── maintenance/page.tsx
└── not-found.tsx                  # Next.js convention, catches unmatched routes
```

## Nested routing rule

A route segment (`[id]/timeline`, `[id]/edit`) is used only for content that is **independently navigable and linkable** (a URL someone could bookmark or share — e.g. "here's the timeline for campaign X"). Content that is merely a *view mode* of the same screen (e.g. switching between overview/timeline/health as tabs) is implemented as tabs backed by a route segment specifically so the URL stays shareable and the browser back button works per-tab — this is why Campaign Detail's tabs above are real route segments (`/campaigns/[id]/timeline`) rather than client-only tab state. This directly resolves the tension between "tabs are lateral, not hierarchical" (04's breadcrumb rule) and "state that should survive a refresh belongs in the URL" (07's Temporary UI State rule): tabs get their own route segment, but breadcrumbs render the parent (`Campaign Detail`) once and show the tab as a secondary in-page control, not as an additional breadcrumb crumb.

## Protected routes

```mermaid
flowchart TD
    Request["Route request"] --> Public{"Public route?"}
    Public -->|Yes: (public), (auth)| Render["Render"]
    Public -->|No| Auth{"Access token valid?"}
    Auth -->|No, refresh succeeds| Render
    Auth -->|No, refresh fails| Login["Redirect to /login?returnTo=..."]
    Auth -->|Yes| Role{"Role check passes?<br/>(per 08)"}
    Role -->|Yes| Render
    Role -->|No| Unauthorized["Redirect to /unauthorized"]
```

Implemented as Next.js middleware (`middleware.ts` — already present in the scaffold as a stub, per its own comment "auth route protection stub") plus a route-group-level guard component for role checks that need decoded-JWT data middleware doesn't have. Middleware handles the coarse authenticated/anonymous split (fast, edge-runnable, no role logic); the `(dashboard)` layout's guard component handles per-route role checks against [08-permission-matrix.md](08-permission-matrix.md), since role and resource-ownership checks are richer than middleware should own.

**Ownership-scoped routes** (e.g. `/campaigns/[id]` for a campaign the current user doesn't own) resolve to the same **404 page**, not a 403 — a deliberate privacy choice (already noted in 03: don't confirm a resource's existence to someone who can't see it) that only applies where hiding existence is meaningful (a candidate's private campaign). **Role-scoped routes** (e.g. `/admin` for a non-admin) resolve to the dedicated **Unauthorized** page instead, since there's no privacy reason to hide that `/admin` exists — the distinction is deliberate, not inconsistent.

## Deep links

Every screen that can be reached via navigation must also be reachable via a direct URL with identical behavior (a shared campaign link works the same as clicking through from the list) — this is a direct consequence of the "filters/tabs/pagination live in the URL" rule (07). The one exception is session-dependent redirects (Onboarding is only reachable as a *result* of registration's redirect logic, not a page someone should deep-link into arbitrarily — though visiting it directly while authenticated and incomplete is harmless and simply resumes it, per 03).

## Navigation guards

- **Unsaved changes**: any dirty Form (05) blocks in-app navigation away with a confirmation dialog; browser-level `beforeunload` is a secondary, best-effort guard for tab close/refresh (never fully reliable, and not pretended to be).
- **In-flight mutation**: navigating away during a pending lifecycle action (e.g. mid-`campaign/:id/start`) does not cancel the request — the mutation completes server-side regardless of client navigation (matches the "no client-side simulation of guarantees the backend doesn't provide" principle; the frontend cannot and should not pretend to cancel a request that's already reached the server).

## 404 / Unauthorized / Maintenance

- **404**: unmatched route, or a deliberately-hidden-for-privacy resource (see above). Copy never implies fault ("this page doesn't exist" not "error").
- **Unauthorized**: authenticated but role-forbidden. Offers a path back to Dashboard, not a dead end.
- **Maintenance Mode**: reserved, no backend trigger exists today (no degraded-mode signal beyond `GET /health` up/down — see OQ-15). Implementation-ready as a static route; wiring its trigger (a feature flag, an env var, a health-check poll) is a future decision, not blocked by anything in this architecture.
