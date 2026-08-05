# Milestone 20 — Product Surface Architecture (Frontend Blueprint)

**Date**: 2026-07-25
**Scope**: Complete architectural blueprint for every user-facing surface of the German Job Engine, produced strictly as documentation — no React components, no implementation code, no backend changes. Milestone 19's validated backend (see [../M19-VALIDATION-REPORT.md](../M19-VALIDATION-REPORT.md)) is treated as fixed ground truth throughout.

## How this document set is organized

| # | Document | Covers |
|---|---|---|
| 1 | [Information Architecture](01-information-architecture.md) | Every product area — purpose, responsibilities, dependencies, real backend grounding |
| 2 | [User Journeys](02-user-journeys.md) | Primary path + every requested alternative path (incomplete profile, expired subscription, failed campaign, retry, provider unavailable, validation errors, suspension) |
| 3 | [Screen Inventory](03-screen-inventory.md) | ~40 screens, each with purpose/entry/exit/permissions/data/APIs/loading/empty/success/failure/edge-cases/navigation |
| 4 | [Dashboard Architecture](04-dashboard-architecture.md) | Global layout, sidebar, top nav, breadcrumbs, every widget's responsibility |
| 5 | [Component Architecture](05-component-architecture.md) | Primitives → Composites → Feature components, each with inputs/outputs/states/variants/a11y/reuse strategy |
| 6 | [API Consumption Architecture](06-api-consumption-architecture.md) | Screen-to-endpoint map, caching/optimistic-update/retry/auth strategy |
| 7 | [State Management Strategy](07-state-management-strategy.md) | 8 state categories, explicit single-owner rule for every fact |
| 8 | [Permission Matrix](08-permission-matrix.md) | Real (role-based) vs. aspirational (subscription-based) access, kept structurally distinct |
| 9 | [Navigation Architecture](09-navigation-architecture.md) | Route tree, protected routes, deep links, guards, 404/401/maintenance |
| 10 | [UX Principles](10-ux-principles.md) | 12 product-wide rules, including platform-specific honesty-about-backend-state |
| 11 | [Design System Foundation](11-design-system-foundation.md) | Tokens only — spacing, type, color structure, dark-mode readiness, no visual design yet |
| 12 | [Architecture Decision Records](12-architecture-decision-records.md) | 8 ADRs covering every technology/pattern choice this blueprint depends on |
| 13 | [Risks and Open Questions](13-risks-and-open-questions.md) | 7 risks with mitigations, 19 open questions mapped to what they block |

## Grounding legend (used throughout every document above)

- **🟢 Live** — a wired backend module with real controllers today. Build against it now.
- **🟡 Dormant** — a real, tested backend module (M14–M19) with no HTTP controller yet. Design fully; wire additively later.
- **⚪ Future** — no backend module exists at all. Pure forward-looking architecture.

---

## Executive Summary

This blueprint covers all 12 areas the milestone requested, grounded against the **real** backend: 25 modules total, 9 wired with live HTTP controllers (62 real endpoints across auth, users, profiles, companies, jobs, campaigns, applications, billing), 16 dormant with no HTTP surface. That grounding is the defining characteristic of this document set — every screen, every API call, every permission rule is checked against actual code (controllers, DTOs, enums, guards), not assumed from the milestone's own example lists. Two real gaps surfaced during that grounding work that the milestone's example lists implied existed but don't: **email verification** and **file-upload transport** for CVs — both are designed for, both are flagged as needing backend work before the corresponding screens can be fully real (§13, OQ-1/OQ-2).

The product surface itself turned out richer than the milestone's own framing suggested in one respect (a fully-live, 9-endpoint `jobs` module — §1.15 — wasn't in the milestone's example area list but is real, live backend functionality that Applications and Companies both depend on) and more aspirational than it suggested in another (Mission Control and Trust Center, the platform's most distinctive planned features, are fully built at the application layer but have **zero** HTTP exposure — §1.8–1.9). Both facts shape the Readiness Assessment below.

Every one of the 12 requested sections is complete: Information Architecture (14 areas, not the milestone's 13 — Jobs added), 7 user journeys (primary + 6 alternative paths), ~40 screens fully specified, dashboard hierarchy with 6 widgets, a 3-tier component system, a full screen-to-endpoint API map, an 8-category state ownership model, a role-vs-subscription permission matrix, a complete route tree with guards, 12 UX principles, and a token-only design foundation ready for a visual-design pass without requiring structural rework.

---

## Readiness Assessment

**Is the project prepared to start frontend development? Yes, for the 🟢 Live surface — with conditions. No, for the 🟡/⚪ surface, and that's the correct state to be in, not a gap in this milestone.**

### Ready to build now, no blockers

Authentication, Onboarding, Profile (with the file-upload caveat below), Company Explorer, Job Listings, Campaign Management (the full 10-state lifecycle), and Applications (the full 15-state lifecycle) are all backed by real, tested, validated (M19) backend endpoints. The architecture in this document set (§1–§11) is sufficient to begin implementation on all of these today, in the sequence suggested below.

### Ready to build, with one condition each

- **Subscription & Billing screen**: architecture is complete (§3), but should not ship to production until `GET /billing/subscriptions/:userId` gets its auth guard (M19 report §5.1, still open as of this milestone) — a real, unfixed security gap, not a frontend concern to route around.
- **CV/photo upload**: the metadata contract is real and buildable now; the actual file-transport mechanism (OQ-2) needs a decision before the upload step can be end-to-end functional, not just UI-complete.

### Deliberately not ready — by design, not oversight

Mission Control, Trust Center, and Notifications are fully specified in this blueprint (§1, §3) precisely so that *when* their backend work lands, implementation is additive (ADR-008) rather than a redesign. They are not ready to build today because the backend isn't ready, and no frontend architecture decision changes that. Administration and Future Enterprise Accounts are intentionally reserved, not designed further, because there's no backend signal yet to design against responsibly (§8, OQ-14).

### Suggested implementation sequence (informative, not a directive — sequencing is an implementation-phase decision)

1. Design-token → visual design pass over §11 (unblocks every screen's actual styling).
2. Shell + Auth + Onboarding + Profile (establishes the state-management and API-consumption patterns, §6–§7, that every later screen reuses).
3. Campaign Management + Company/Job browsing (the core product loop).
4. Applications (the richest state machine — benefits from the patterns above already being proven out).
5. Billing (read-only) once the backend auth-guard fix lands.
6. Mission Control / Trust Center / Notifications — only once their respective backend work (a Mission Control controller; the Trust Center traceId fix; a Notifications module) exists.

### What would make this a "no"

If implementation began by building Mission Control or Notifications first, or by treating the subscription-gating rows in §8 as real enforcement, or by shipping the Billing screen against the currently-unguarded endpoint — each of those would be building on ground this document set explicitly marked as not solid yet. The blueprint's job was to make sure nobody has to discover that the hard way; §13 exists specifically so those risks are visible before implementation starts, not after.
