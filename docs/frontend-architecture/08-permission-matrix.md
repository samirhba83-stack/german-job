# 8. Permission Matrix

## Two different kinds of "permission" in this system — do not conflate them

1. **Role-based** (`UserRole`: `ADMIN` / `EMPLOYER` / `CANDIDATE`) — real, server-enforced today via `JwtAuthGuard` + `RolesGuard` + `@Roles()` on every guarded controller/route, confirmed by direct inspection of all 8 wired controllers. This is a genuine security boundary.
2. **Subscription-based** (`SubscriptionStatus`: `TRIALING` / `ACTIVE` / `PAST_DUE` / `CANCELED`) — **not enforced anywhere server-side today.** No controller checks subscription status before allowing an action. This matrix documents what subscription gating *should* look like once it exists, and marks every such row explicitly as frontend-only / not yet backend-enforced, so nobody mistakes this document for a description of current security.

Building UI that assumes #2 is already a real boundary would be actively misleading — see [13-risks-and-open-questions.md](13-risks-and-open-questions.md) OQ-11.

---

## Role-based access (server-enforced today — verified against real guards)

| Area / Action | Anonymous | `CANDIDATE` | `EMPLOYER` | `ADMIN` |
|---|:---:|:---:|:---:|:---:|
| Browse Companies (search/list/detail) | ✅ | ✅ | ✅ | ✅ |
| Create/Edit/Archive Company | ❌ | ❌ | ✅ (own) | ✅ (any) |
| Browse Jobs (search/list/detail) | ✅ | ✅ | ✅ | ✅ |
| Create/Edit/Publish/Archive/Close Job | ❌ | ❌ | ✅ (own company's) | ✅ (any) |
| View own Profile | ❌ | ✅ | ✅ | ✅ |
| Edit own Profile | ❌ | ✅ | ✅ | ✅ |
| Create Campaign | ❌ | ✅ | ❌ | ✅ |
| View/Edit/Control own Campaign | ❌ | ✅ (own only) | ❌ | ✅ (any) |
| Create Application | ❌ | ✅ | ❌ | ✅ |
| View Application | ❌ | ✅ (own, as candidate) | ✅ (as target company — see note) | ✅ (any) |
| Prepare/Queue/Send Application | ❌ | ✅ (own) | ❌ | ✅ |
| Register Company Reply / Schedule / Complete Interview / Record Offer | ❌ | ❌ | ✅ | ✅ |
| Sign Contract | ❌ | ✅ (own) | ❌ | ✅ |
| Reject Application | ❌ | ❌ | ✅ | ✅ |
| Withdraw Application | ❌ | ✅ (own) | ❌ | ✅ |
| Archive Application | ❌ | ✅* | ✅* | ✅ |
| Mark Delivered / Opened / Viewed (tracking signals) | ❌ | ❌ | ❌ | ✅ only |
| View own Subscription status | ❌ | ✅ | ✅ | ✅ |
| Administration surface | ❌ | ❌ | ❌ | ✅ (reserved, no content yet) |

`*` — `applications/:id/archive` carries no `@Roles()` restriction beyond the controller's class-level `JwtAuthGuard` (confirmed by direct inspection — no `RolesGuard`/`@Roles` decorator on that one handler, unlike every sibling action). Any authenticated role can call it today. Whether that's intentional (archiving is a low-stakes, universally-safe action) or an oversight is not this milestone's call to make — flagged as OQ-12, and the frontend should show the Archive action to any authenticated participant on the application (candidate, target employer, admin) to match actual server behavior, not a narrower assumption.

**Note on Application visibility**: the backend does not auto-scope `GET /applications/:id` (or `search`) by the requesting user's identity — any authenticated user can fetch any application by id or by search filter today (the controller has no ownership check on reads, only on writes). The frontend's role-based *hiding* of other users' applications from list views is therefore a UX/privacy courtesy layered on top, not an enforced boundary — see OQ-13. This is the same pattern already called out in [06-api-consumption-architecture.md](06-api-consumption-architecture.md): hidden ≠ secured.

---

## Subscription-based access (⚠ not backend-enforced — documents intended future state only)

| Area / Action | Anonymous | Registered, no subscription | `TRIALING`/`ACTIVE` ("Subscribed") | `PAST_DUE`/`CANCELED` ("Expired") |
|---|:---:|:---:|:---:|:---:|
| Browse Companies/Jobs | ✅ | ✅ | ✅ | ✅ |
| Complete Profile | ❌ | ✅ | ✅ | ✅ |
| Create Campaign | ❌ | 🔶 intended: limited/blocked | ✅ | 🔶 intended: blocked, with an upgrade prompt |
| Number of active Campaigns | — | 🔶 intended: tier-limited (no quota mechanism exists — `execution-quota` policy in dormant `business-policy-enforcement`) | 🔶 intended: tier-limited | 🔶 intended: 0 new, existing may run to completion |
| Send Applications | — | ✅ (no gate exists) | ✅ | 🔶 intended: blocked |
| View Mission Control / Trust Center | — | — | 🔶 intended: gated feature (once built) | 🔶 intended: read-only or blocked |

Every 🔶 cell is a **product intention with no backend mechanism behind it today.** Build the Permission Matrix's UI surface for it (upgrade prompts, disabled states with explanation — matching the Billing screen's "coming soon, not hidden" pattern from 03) but do not build client-side enforcement logic that pretends to be a real gate; a client-only gate on a JWT-authenticated API is trivially bypassed and would be worse than no gate at all if it creates a false sense of security. See OQ-11.

---

## Administrator

`UserRole.ADMIN` is real and already threaded through every guarded controller's `@Roles()` list (confirmed: companies, jobs, campaigns, applications all accept `ADMIN` alongside the relevant primary role). An admin can act on **any** user's campaigns, applications, companies, and jobs through the exact same endpoints as an owner — there is no separate admin API surface, and therefore no separate admin UI is strictly required for core CRUD; an admin using the same screens as any other user, with ownership checks relaxed, is a faithful reflection of how the backend actually works. The reserved `/admin` route (03) is for platform-wide tooling (user list, metrics) that has no backend endpoint at all yet, not for a duplicate of the resource screens.

## Future Enterprise Accounts ⚪

No backend concept exists — no `UserRole.ENTERPRISE`, no organization/team entity, no seat management. Reserved in this matrix as a placeholder column for a future role that would sit between `EMPLOYER` and `ADMIN` in scope (multiple users acting on one company's jobs/applications, with internal permission tiers) — this is intentionally not designed further here, since inventing the shape of a role with zero backend signal risks designing the wrong thing. See OQ-14.

---

## How this matrix drives the frontend

Every screen in [03-screen-inventory.md](03-screen-inventory.md) and every action in [05-component-architecture.md](05-component-architecture.md)'s `*LifecycleActionBar` components reads from one shared, typed permission-check module (`can(user, action, resource)` — see ADR-005, §12) rather than each screen hand-rolling its own role check. That module encodes exactly the role-based table above (the real, enforced rules) and exposes the subscription-based table's 🔶 rows as a separate, clearly-named set of checks (`intended*`) so implementers can never accidentally treat an aspirational rule as an enforced one.
