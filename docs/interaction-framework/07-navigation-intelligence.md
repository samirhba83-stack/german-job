# 7. Navigation Intelligence

## What's real today vs. reserved for page-implementation work

| Requested signal | Status | Where |
|---|---|---|
| Current Workspace | 🟢 Real | `Breadcrumbs` (`components/shell/breadcrumbs.tsx`) + `PrimarySidebar`'s active-item highlight, both derived from `usePathname()`; `workspace-switcher.tsx` (Milestone 22.2) honestly shows the single real workspace the user has, not a fabricated multi-workspace picker |
| Current Campaign / Current Company | ⚪ Not built | Requires a real detail screen with real fetched data to know "which campaign" — reserved for the next milestone's Campaign/Company Workspace pages ([14](14-risks-and-future-expansion.md)) |
| Current Step | 🟢 Real, where it exists | `ExecutionStageList` ([03](03-execution-feedback.md)) already shows the current stage within whatever real stage sequence it's given |
| Mission Progress | 🟢 Real, per-campaign | `getMissionStatus()` ([05](05-mission-status.md)) |
| Recent Activity | 🟢 Real, generic | The Background Activity Center ([06](06-background-activity-center.md)) is the real "recent activity" surface this milestone builds; a domain-specific recent-activity feed (real application/campaign transitions) is `Activity Feed`, specified but not built in [M21 §7](../design-system/07-component-library.md) Part B, reserved for page-implementation |

## Reducing cognitive load — what's actually implemented

The Breadcrumbs and Sidebar together answer "where am I" without requiring a user to track it mentally: the active sidebar item and the breadcrumb trail are always derived from the same single source (the current route), so they can never disagree with each other — a structural guarantee, not a synchronization discipline two separate pieces of state would need to maintain.

## Why "Current Campaign" isn't faked

A generic-looking "Current Campaign: —" placeholder in the header would imply a capability (context-aware navigation scoped to a specific resource) that doesn't exist yet, since no Campaign Workspace page exists to establish that context. Per this whole document set's standing discipline, an absent capability is represented by its absence, not a placeholder that could be mistaken for a working, empty state.

## Every navigation target now goes somewhere real (Milestone 22.3)

The audit found the inverse problem of the paragraph above: several real, clickable navigation targets (`/campaigns`, `/companies`, `/settings`, `/profile`, `/mission-control`, `/admin`, and three Quick Actions creation routes) had no page at all. Most 404'd; `/jobs/new` was worse, silently rendering the wrong page (`JobListingDetail` for a job named "new") due to Next.js's static-before-dynamic route precedence — a defect a user could hit without any visible error. Every one of these now has a real `page.tsx` rendering `NotYetAvailable` with a specific, accurate reason (see [13, ADR-008](13-decision-records.md)). Route-level role protection was also added — `/admin` was previously only hidden from the Sidebar's rendered list for a non-admin user, not actually blocked from direct navigation ([13, ADR-009](13-decision-records.md)).
