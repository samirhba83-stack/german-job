# 12. Architecture Decision Records

Standard ADR format: Context, Decision, Consequences, Alternatives Considered. Numbered sequentially; superseding an ADR later means adding a new one that references it, never silently editing history.

---

### ADR-001: Server state via a dedicated query-caching library (TanStack Query)

**Context**: no data-fetching library exists in `apps/web` today — `lib/api-client.ts` is a bare `fetch` wrapper. Every screen in [03-screen-inventory.md](03-screen-inventory.md) needs consistent loading/caching/retry/invalidation behavior (§6), and every dashboard widget (§4) needs independent fetch/error boundaries.

**Decision**: adopt TanStack Query (React Query) as the server-state layer, sitting between the API client modules and screens/hooks (§6's layered client diagram). Query keys follow `[resource, params]`; mutations invalidate affected keys explicitly per the map in §6.

**Consequences**: cache invalidation, staleness, refetch-on-focus, and retry are solved by a maintained library instead of hand-rolled — directly avoids the failure mode described in [07-state-management-strategy.md](07-state-management-strategy.md) ("why this split, not a single global store"). Adds one new dependency to `apps/web`.

**Alternatives considered**: SWR (comparable capability; TanStack Query's mutation-invalidation API is a more direct fit for this platform's write-heavy lifecycle-action pattern — 20 application mutations, 9 campaign mutations, each needing precise cache invalidation). Hand-rolled fetch + `useState`/`useEffect` (rejected — this is exactly the pattern that produces the stale-cache bugs §7 is designed to prevent, and would require reimplementing request deduplication and staleness by hand across ~40 screens).

---

### ADR-002: Minimal global UI store (Zustand)

**Context**: [07-state-management-strategy.md](07-state-management-strategy.md) identifies a small Global UI State category (sidebar collapsed, theme, notification-panel open) that is neither server state nor URL state nor local component state.

**Decision**: one small Zustand store for exactly this category. No domain data ever enters it — enforced by convention and by ADR-001 already owning all server state.

**Consequences**: a single, simple store keeps "what global client state exists" answerable at a glance; the discipline of never putting server data in it depends on code review, not a technical barrier (see [13-risks-and-open-questions.md](13-risks-and-open-questions.md) OQ-17 for how future engineers might be tempted to violate this).

**Alternatives considered**: Redux Toolkit (rejected as heavier than the actual scope of client-only state warrants — this store is intentionally small); React Context alone (rejected — re-render characteristics are worse for frequently-read, rarely-written global flags like sidebar state, and Zustand's selector model avoids that without added ceremony).

---

### ADR-003: Access token in memory, refresh token strategy deferred pending a backend decision

**Context**: [07-state-management-strategy.md](07-state-management-strategy.md) flags that the backend returns both tokens in the response body (`AuthTokensDto`) with no `httpOnly` cookie option today — the frontend must choose where to hold the refresh token, and every option has a real tradeoff given that constraint.

**Decision**: hold the access token in memory only (never `localStorage`, mitigating XSS token theft for the short-lived token). For the refresh token, use `localStorage` **as an interim choice**, explicitly flagged as inferior to an `httpOnly` cookie, because the backend doesn't support the cookie approach yet. This ADR is superseded the moment the backend adds cookie-based refresh-token issuance — tracked as OQ-10.

**Consequences**: a real, acknowledged XSS exposure on the refresh token persists until the backend change lands. This is stated plainly rather than glossed over, matching this whole document set's stance on not overstating a security guarantee that doesn't exist (see [08-permission-matrix.md](08-permission-matrix.md)'s "hidden ≠ secured" principle applied here to storage instead of UI).

**Alternatives considered**: refusing to persist the refresh token at all (session-only, re-login every browser restart) — rejected as a worse product tradeoff than the interim security exposure, but noted as the safer fallback if the cookie-based backend change is deprioritized long-term.

---

### ADR-004: Shared response/DTO types live in `@german-job-engine/shared-types`, not duplicated in `apps/web`

**Context**: `shared-types` already exists as a pnpm workspace package and already provides every domain enum (`UserRole`, `CampaignStatus`, etc.) and several DTOs. Backend controllers' own response DTOs (`CampaignResponseDto`, `ApplicationResponseDto`, etc., defined in `apps/api`) aren't all mirrored there yet.

**Decision**: every type the frontend needs that crosses the API boundary is added to (or already exists in) `shared-types`, never hand-typed a second time inside `apps/web`.

**Consequences**: one source of truth for the shape of every API response; a backend DTO change and a frontend type going out of sync becomes a build-time, monorepo-wide TypeScript error instead of a silent runtime mismatch. Requires backend-side discipline to keep `shared-types` current when a controller's response DTO changes — not automatic, and not enforced by tooling today (see OQ-9 on verifying the actual response envelope first).

**Alternatives considered**: generating types from the live Swagger/OpenAPI schema (real option, deferred rather than rejected — see OQ-18; would remove the manual-sync risk above entirely, but introduces a build-step dependency on a running or exported API schema, which is more machinery than this milestone's scope warrants deciding now).

---

### ADR-005: One shared, typed permission-check module, not per-screen role checks

**Context**: [08-permission-matrix.md](08-permission-matrix.md) has two structurally different kinds of rule — real, server-enforced role checks, and aspirational, not-yet-enforced subscription checks — and both need to be consulted from many screens without either being hand-copied per screen or accidentally conflated.

**Decision**: a single `can(user, action, resource)` module encodes the real role-based table; a separately-named `intendedCan(...)` (or equivalent naming that cannot be mistaken for the enforced check) encodes the subscription-based table. Every screen and every `*LifecycleActionBar` feature component (05) calls into this module rather than inlining `user.role === 'ADMIN'`-style checks.

**Consequences**: the role-vs-subscription distinction that this whole document set insists on (08's opening section) is structurally impossible to blur in code, not just documented as a convention. Adding a new guarded action requires one table update, not a hunt through every screen that might check it.

**Alternatives considered**: colocating permission checks with each feature component (rejected — this is exactly how the distinction above erodes over time, one screen at a time).

---

### ADR-006: Continue Next.js App Router + Tailwind CSS; do not introduce a component library wholesale

**Context**: the scaffold already commits to Next.js 14 App Router and Tailwind CSS (`apps/web/package.json`). [05-component-architecture.md](05-component-architecture.md) and [11-design-system-foundation.md](11-design-system-foundation.md) need a styling/component foundation to build on.

**Decision**: keep the existing stack. Build the Primitives tier (05) as hand-built, token-driven components (11) rather than adopting a full pre-styled component library (e.g. Chakra, MUI, or even shadcn/ui's copy-paste model) wholesale.

**Consequences**: full control over the token system (11) and no fighting a third-party library's own theming assumptions when dark mode / status-color semantics (which are unusually central to this product — status badges everywhere) need to be exact. More upfront component-building work than adopting a library would require.

**Alternatives considered**: shadcn/ui specifically (a real, reasonable alternative — its copy-into-your-repo model doesn't have the "fighting a library's assumptions" downside a traditional npm-installed component library would; deferred rather than rejected, flagged as OQ-19 for a follow-up decision once visual design begins, since it wouldn't change anything in this document set's contracts either way — Primitives' *inputs/outputs/states* stay identical regardless of what's underneath them).

---

### ADR-007: Optimistic updates are opt-in per mutation, default is pessimistic

**Context**: [06-api-consumption-architecture.md](06-api-consumption-architecture.md) identifies that lifecycle-transition mutations (campaign/application actions) can be rejected by server-side domain guards for reasons the client can't fully predict.

**Decision**: the default mutation pattern is pessimistic (wait for the real response before updating the UI). Optimistic updates require an explicit, individually-justified exception — and per §6's analysis, none of the current lifecycle actions qualify.

**Consequences**: slightly less snappy UI for actions than an optimistic-by-default approach, in exchange for the UI never showing a state the backend then contradicts — directly protects the trust relationship [10-ux-principles.md](10-ux-principles.md) principle 12 is built around.

**Alternatives considered**: optimistic-by-default with rollback (rejected as the wrong default for a platform whose core actions are guarded domain-state transitions, not simple CRUD).

---

### ADR-008: Feature-flag dormant (🟡) and future (⚪) screens at the route level, not the component level

**Context**: Mission Control, Trust Center, and Notifications have no backend surface yet, but their screens are fully designed (§3) so implementation can proceed without a later redesign once the backend catches up.

**Decision**: these routes exist and render today, showing their honest "not connected yet" state (§3, §4, §10 principle 12) — they are not hidden behind a build-time feature flag that removes them from the bundle/routing entirely. Wiring a real backend later is a data-layer change (swap the "not available" state for a real query) inside the same screen, not a new screen or a routing change.

**Consequences**: users can see (in a clearly-labeled, honest form) what's coming, which is a deliberate product-transparency choice consistent with this whole platform's disclosure conventions (Mission Control's own M17-era `note`/`null` field pattern, applied at the UI layer). Requires discipline to keep the "not connected" state genuinely honest rather than letting it drift into looking like a real feature over time.

**Alternatives considered**: fully hiding unbuilt areas from navigation until backend-ready (rejected — contradicts the milestone's explicit request to design these areas now, and loses the transparency benefit above for comparatively little gain, since the routes and components need to be built either way per this milestone's own scope).
