# 13. Decision Records

Same Context/Decision/Consequences/Alternatives-Considered format as every prior milestone. Split into Architecture Decision Records (structural/technical choices) and Interaction Decision Records (behavioral/UX choices specific to this milestone's interaction framework).

---

## Architecture Decision Records

### ADR-001: Delete the old root `app/page.tsx`; move root to `app/(dashboard)/page.tsx`

**Context**: the M1-era scaffold's `app/page.tsx` (a static marketing placeholder) and M20's architecture (which treats `/` as the authenticated Dashboard, inside the shell) resolve to the same route — Next.js cannot serve both.

**Decision**: delete the old file, create `(dashboard)/page.tsx` (a minimal, shell-proving placeholder, not a real Dashboard) at the same route.

**Consequences**: `/` now requires a session and renders inside `AppShell`, matching [M20's documented navigation architecture](../frontend-architecture/09-navigation-architecture.md) exactly. Loses the placeholder's public-marketing role — a real public landing page (M20's separate `(public)` route group) doesn't exist yet and would need its own route if built later, not `/`.

**Alternatives considered**: keep the old page at `/` and put the Dashboard at a different path (rejected — contradicts M20's explicit, already-established IA, which this milestone must not redesign).

---

### ADR-002: Middleware reads a non-httpOnly marker cookie; real auth verification happens client-side

**Context**: [M20's ADR-003](../frontend-architecture/12-architecture-decision-records.md) already chose memory-only access token + localStorage refresh token as an interim measure, because the backend doesn't issue an httpOnly cookie. Next.js Edge middleware cannot read `localStorage` or React state — it needs *something* cookie-shaped to make even a coarse routing decision.

**Decision**: `lib/stores/auth-store.ts` sets a second, non-httpOnly, non-sensitive cookie (`gje_session=1`) alongside the real tokens purely as a presence marker; `middleware.ts` checks only for that cookie's existence. The real check — decoding the JWT, verifying a real session exists — happens in `components/shell/app-shell.tsx`, which has access to the actual Zustand store.

**Consequences**: middleware can do a fast, coarse "logged in at all, probably" redirect without needing the backend to change. This cookie carries zero security weight — it is explicitly documented as such in three places (`auth-store.ts`, `middleware.ts`, `app-shell.tsx`) so a future engineer can't mistake it for a real boundary, per [M20's "hidden ≠ secured" principle](../frontend-architecture/08-permission-matrix.md).

**Alternatives considered**: no middleware guard at all, client-side-only redirect (rejected — would show a flash of the shell/redirect-in-progress on every protected route load, worse UX than middleware's near-instant redirect); waiting for a real httpOnly-cookie backend change before building any route guard (rejected — blocks this entire milestone on backend work outside its scope).

---

### ADR-003: `apiClient` unwraps a real `{ data: T }` response envelope — a genuine finding, not an assumption

**Context**: [M20's OQ-9](../frontend-architecture/13-risks-and-open-questions.md) flagged this as unverified: "does `TransformInterceptor` change any response envelope shape in practice? Verify against a live response before finalizing." This milestone did exactly that.

**Decision**: `POST /auth/register` was called against the real, running backend (2026-07-25). The raw response was `{"data":{"accessToken":"...","refreshToken":"..."}}` — confirmed, not inferred. `apiClient` now unwraps `.data` on every successful response.

**Consequences**: every `*.api.ts` module in the codebase can keep returning the plain DTO type (`AuthTokensDto`, not `{ data: AuthTokensDto }`), because the unwrapping happens once, centrally. Had this gone unverified and shipped with the original (wrong) assumption, every single API call in the product would have silently returned `{ data: {...} }` instead of the DTO, breaking every feature at once the moment real backend calls were made.

**Alternatives considered**: none — this was a factual verification, not a design choice with real alternatives.

---

### ADR-004: `ApiError` message extraction handles NestJS's real nested exception shape

**Context**: live testing (a real 401 from `LocalAuthGuard`, a real 400 from `ValidationPipe`) showed `message` is not always the flat `string | string[]` [M20 §6](../frontend-architecture/06-api-consumption-architecture.md) described — NestJS's built-in exceptions return `exception.getResponse()` as `{ message, error, statusCode }`, and `AllExceptionsFilter` forwards it as-is, producing a *nested* `message.message`.

**Decision**: `extractMessage()` checks whether `body.message` is already flat (a hand-thrown domain exception, which does pass a plain string) or nested (a NestJS built-in exception), and normalizes both to the flat form before constructing `ApiError`.

**Consequences**: every error toast in the app now shows the real backend message in both cases, instead of only working for hand-thrown domain exceptions and falling back to "Something went wrong" for the (very common — every validation error, every 401) built-in-exception case.

**Alternatives considered**: fixing this on the backend instead (changing `AllExceptionsFilter` to always flatten `message`) — a real, arguably cleaner option, but out of this milestone's scope ("do not implement business logic... maintain compatibility," and backend changes are explicitly not this milestone's job); flagged in [14-risks-and-future-expansion.md](14-risks-and-future-expansion.md) as worth considering for a future backend milestone instead.

---

### ADR-005: Design tokens implemented as CSS custom properties + Tailwind `withOpacity` color functions

**Context**: [M20/M21](../design-system/03-design-tokens.md) specified dark mode as "a CSS custom-property layer... components only ever reference the semantic token name" — this milestone had to actually implement that mechanism in Tailwind.

**Decision**: every M21 color token is a `globals.css` custom property (`r g b` triplet format), mapped in `tailwind.config.ts` via a `withOpacity()` helper producing `rgb(var(--x) / <alpha-value>)` — so Tailwind's opacity modifiers (`bg-accent/10`) work correctly against theme-aware values, and `[data-theme="dark"]` swaps the underlying variables with zero component-level branching.

**Consequences**: exactly matches M21's specified mechanism; verified working via a real production build. One fragile pattern was found and removed during implementation — mixing a raw CSS var reference inside Tailwind's arbitrary-opacity bracket syntax (`bg-scrim/[var(...)]`) risked unpredictable build behavior and was replaced with a plain inline `style` for that one case (the modal scrim).

**Alternatives considered**: a CSS-in-JS theming library (rejected — [M20 ADR-006](../frontend-architecture/12-architecture-decision-records.md) already committed to plain Tailwind, no additional styling system).

---

### ADR-006: `DropdownMenuTrigger` uses an "asChild" pattern (`Children.only` + `cloneElement`) instead of wrapping its child

**Context**: Milestone 22.2's self-review found `DropdownMenuTrigger` wrapped its child (usually a real `<button>`) in a second interactive `<span role="button" tabIndex={0}>` — invalid, double-focusable HTML, and the actual root cause of `DropdownMenuItem` needing to nest a `<Link>` inside a `<button>` in `profile-menu.tsx` too, since the whole component tree had normalized around "the trigger is always a wrapper."

**Decision**: `DropdownMenuTrigger` now requires exactly one child element (`Children.only`) and attaches the open/close click handler and keyboard handling to that real element via `cloneElement`, adding `aria-haspopup`/`aria-expanded` to it directly — the same pattern Radix and most production menu libraries use for this exact reason.

**Consequences**: the DOM now has exactly one interactive element per trigger, matching real semantics. `DropdownMenuItem` could then be fixed the same way — accepting an `href` prop and rendering a single `<Link role="menuitem">` instead of nesting a link inside a button.

**Alternatives considered**: keeping the wrapper `<span>` but adding `tabIndex={-1}` to the inner child to prevent double-tabbing (rejected — treats the symptom, not the cause, and still leaves two elements both claiming an interactive role in the accessibility tree).

---

### ADR-007: Theme system uses an inline pre-hydration boot script, not a `next-themes`-style library dependency

**Context**: M21 committed dark-mode CSS custom properties in Milestone 21, but no Theme Switcher existed to let a user actually choose a theme — a real, complete gap this milestone's self-review found. Reading the stored preference only after React hydrates would cause a visible flash of the wrong theme on every load.

**Decision**: `theme-boot-script.tsx` is a small inline script (`dangerouslySetInnerHTML`) placed in `<head>`, reading `localStorage` synchronously and setting `data-theme` on `<html>` before first paint — paired with `suppressHydrationWarning` on `<html>` since the attribute is deliberately set outside React's render. `theme-store.ts` (Zustand) starts at `'system'` to match what the server rendered, then `theme-initializer.tsx` syncs the store to the real stored value on mount without touching the DOM again (the boot script already did).

**Consequences**: zero flash of the wrong theme, and no new runtime dependency — matches [M20 ADR-006](../frontend-architecture/12-architecture-decision-records.md)'s "no additional styling/theming library" commitment exactly, using a technique (inline boot script + `suppressHydrationWarning`) that is itself the same one libraries like `next-themes` use internally.

**Alternatives considered**: `next-themes` (rejected — a real dependency for a small, well-understood mechanism this codebase can implement directly and keep full control over, consistent with this project's general preference to avoid adding libraries for problems with a small, explicit solution); reading the theme only client-side after mount (rejected — causes the flash this decision exists to avoid).

---

## Interaction Decision Records

### IDR-001: `useTrackedMutation` tracks its activity id via a `ref`, not TanStack Query's `context`

**Context**: an early implementation tried threading a Background Activity id through `useMutation`'s generic `TContext`, and hit real TypeScript arity errors from TanStack Query v5's callback signatures (`onMutate`/`onSuccess`/`onError` all changed shape in ways that fought a hand-rolled context type).

**Decision**: track the id in a plain `useRef`, closed over by the mutation's callbacks — sidesteps the generic entirely.

**Consequences**: simpler, more robust code that doesn't need to track TanStack Query's exact minor-version callback signatures. Slight cost: the ref means a single `useTrackedMutation` instance can't cleanly track two fully-concurrent invocations of the *same* mutation object — acceptable, since each call site typically renders its own hook instance.

**Alternatives considered**: fighting the generic typing further (rejected — the real error required understanding an internal library type change, not a design decision worth encoding as a permanent constraint); using `onSuccess`/`onError`'s callback arguments to smuggle the id (not viable — the id needs to exist before the mutation function even runs, at `onMutate` time).

---

### IDR-002: Mission Status is a derived, relabeling function — never a stored, independent state

**Context**: the milestone's seven Mission Status states could have been implemented as their own persisted concept (e.g. stored client-side, updated by events) or as a pure derivation from real `CampaignStatus`.

**Decision**: `getMissionStatus()` is a pure function with no state of its own — called fresh every render from the real `CampaignStatus` value.

**Consequences**: Mission Status can never drift out of sync with the real backend status, because it has no independent existence to drift — this is the direct implementation of [Career Intelligence's Principle 3, historical consistency](../career-intelligence/01-career-intelligence-principles.md), applied to UI state instead of intelligence data.

**Alternatives considered**: a Zustand store caching the last-known mission status per campaign (rejected — would reintroduce exactly the "two sources of truth" risk [M20's state management strategy](../frontend-architecture/07-state-management-strategy.md) is built to prevent).

---

### IDR-003: `ExecutionStageList` ships with zero built-in data sources for the dormant pipeline stages

**Context**: the fastest way to "demonstrate" real-time execution feedback matching the milestone's example list would have been to hardcode the named stages (Analyzing Companies, Generating CV Package, ...) with a plausible-looking status progression.

**Decision**: the component is built generic and data-source-agnostic; the only real data mapping shipped (`application-lifecycle-stages.ts`) uses genuinely live backend data. No stage list anywhere in the codebase names "Analyzing Companies" or similar dormant-pipeline concepts with any status attached.

**Consequences**: the milestone's own example stages are visibly *not* fully demonstrated end-to-end in this shell — a real, honest gap, not hidden. In exchange, nothing in this codebase violates "never simulate progress," which was restated three times in the milestone's own text specifically to prevent this shortcut.

**Alternatives considered**: hardcoding the example stages with a `setTimeout`-driven fake progression for demo purposes (rejected outright — this is precisely "mock workflows," explicitly forbidden).

---

### IDR-004: Background Activity Center omits "estimated remaining work"

**Context**: covered in full in [06-background-activity-center.md](06-background-activity-center.md) — restated here as a decision record because it's a real, deliberate omission of a milestone-requested feature, not an oversight.

**Decision**: not implemented; `BackgroundActivity` has no duration-estimate field.

**Consequences**: the Background Activity Center is visibly incomplete relative to the milestone's literal example list. Accepted because every real mutation in this codebase resolves in well under a second, making an estimate both unnecessary and, if fabricated, dishonest.

**Alternatives considered**: a generic "usually takes a few seconds" static message (rejected — not a real estimate, just decoration wearing an estimate's clothes, which is the same failure mode as fake progress bars).

---

### IDR-005: Toast and Background Activity Center remain two distinct mechanisms, not merged into one

**Context**: it would be simpler to have exactly one feedback surface instead of two.

**Decision**: keep them separate — Toast is transient and immediate, Background Activity Center is persistent and reviewable.

**Consequences**: a small amount of duplication (both fire from the same `useTrackedMutation` call) in exchange for serving two genuinely different needs — "acknowledge this right now" vs. "let me check what happened while I was looking away" — matching [M20's original Notification Center panel design intent](../frontend-architecture/05-component-architecture.md), now realized as two purpose-built pieces instead of one overloaded one.

**Alternatives considered**: a single unified activity feed with no separate toast (rejected — loses the immediate, in-the-moment acknowledgment [Interaction Principle "every completed action is acknowledged"](02-interaction-principles.md) calls for, since a panel the user has to open isn't immediate).

---

### IDR-006: `RESUMING` and `CANCELLED` get their own Mission Status states instead of staying folded into `Waiting`/`Idle`

**Context**: M22's original mapping folded `RESUMING` into the same `Waiting` bucket as `COOLING_DOWN`, and `CANCELLED` into the same `Idle` bucket as `DRAFT`/`ARCHIVED`. Both were real, live enum values being under-differentiated for the sake of a smaller state list.

**Decision**: split them — `RESUMING` → `Recovering` (Milestone 22.2's own requested addition), `CANCELLED` → `Cancelled`. `COOLING_DOWN` (deliberate, healthy slowdown) and `RESUMING` (actively working to come back) are operationally different enough to a user reading a status badge that collapsing them loses real information the backend already provides for free.

**Consequences**: nine Mission Status states instead of seven, each still a pure, honest relabeling of a real `CampaignStatus` value — no new backend concept was invented to support this, only a finer-grained mapping of one that already existed.

**Alternatives considered**: leaving `ARCHIVED` folded into `Idle` unchanged too (the milestone only asked for Recovering/Cancelled) — accepted as a known, minor imprecision rather than expanded scope; noted honestly here rather than silently "fixed" alongside the two the milestone actually requested.

---

### IDR-007: Background Activity retry re-invokes the original mutation with its original variables, tracked via a `ref`

**Context**: the milestone asked for a real Retry affordance on failed background tasks. The naive approach — re-running `mutationFn` with no arguments — doesn't work for any mutation that takes real input (a login's credentials, a profile update's payload).

**Decision**: `useTrackedMutation` tracks the most recent call's variables in a `lastVariablesRef`, set in `onMutate` (the same ref-based approach as IDR-001 above's activity-id tracking), and the `retry` callback stored on a failed `BackgroundActivity` calls `mutation.mutate(lastVariablesRef.current)` — a real re-execution of the exact original call, not a page reload or a re-prompt.

**Consequences**: Retry is only offered when `isRetryable(error)` is true (network failure or a real 5xx) — a 4xx is never retryable, since retrying invalid input or a permission failure verbatim would just fail identically again, and offering a button that can't succeed would be dishonest UI, the same principle [04](04-interaction-feedback-system.md) already applies to read-retries.

**Alternatives considered**: threading retry variables through TanStack Query's mutation `context` instead of a ref (rejected for the same v5 arity-fighting reason as IDR-001).

---

### IDR-008: `Accordion`'s expand/collapse animation uses a CSS grid `0fr`→`1fr` transition, not JS height measurement or a fixed max-height

**Context**: animating from `height: 0` to an unknown content height in pure CSS is a known hard problem — `max-height` transitions require guessing an upper bound (breaks for long content) and JS-measured height requires a `ResizeObserver` and extra render cycles for a component this milestone doesn't want to over-engineer.

**Decision**: wrap the content in a grid container transitioning `grid-template-rows` between `0fr` and `1fr` (a well-established CSS-only technique), with an inner `overflow-hidden` div — no JS measurement, no guessed max-height, using the shell's existing `duration-base`/`ease-standard` motion tokens rather than inventing new ones.

**Consequences**: correct height animation for arbitrary content with zero JS overhead. The collapsed content also gets `aria-hidden="true"` (rather than the `hidden` attribute, which would prevent the transition from being visible at all) so it's removed from the accessibility tree while still being visually animatable.

**Alternatives considered**: `hidden` attribute with no animation (rejected — loses the "content entrance via motion-base" visual spec [M21 §7](../design-system/07-component-library.md) asks for); a `ResizeObserver`-based JS height measurement (rejected — real complexity for a problem the CSS grid technique already solves cleanly).

---

### IDR-009: Workspace Switcher shows the single real workspace instead of a placeholder multi-workspace picker

**Context**: the milestone asked for a Workspace Switcher as a genuinely new shell element. No backend concept of "multiple workspaces per user" exists anywhere in the platform — a user has exactly one identity.

**Decision**: `workspace-switcher.tsx` displays the current user's own real name/email as the "workspace," with no dropdown of other options to switch to.

**Consequences**: the component satisfies the milestone's structural request (a real, present Workspace Switcher element in the header) without implying a multi-tenant capability that doesn't exist — consistent with this whole document set's standing rule that an absent capability is represented by its absence, not a placeholder that could be mistaken for a working one ([07](07-navigation-intelligence.md)'s "why Current Campaign isn't faked" applies the identical reasoning).

**Alternatives considered**: omitting the component entirely until real multi-workspace support exists (rejected — the milestone explicitly asked for this element, and an honest single-workspace display is a real, correct implementation of it, not a fabrication).

---

## Milestone 22.3 Decision Records

### ADR-008: Every Sidebar/Quick Actions/Profile Menu `href` gets a real `page.tsx`, even where the real feature isn't built

**Context**: Milestone 22.3's audit found that `/campaigns`, `/companies`, `/settings`, `/profile`, `/mission-control`, `/admin`, `/jobs/new`, `/companies/new`, and `/campaigns/new` were all real, clickable navigation targets in the shipped shell with no corresponding route at all. Most 404'd; `/jobs/new` was worse — Next.js's static-route-before-dynamic-route precedence meant it silently rendered `JobListingDetail` for a job literally named "new," a wrong page rendered as if it were correct, with no visible error at all.

**Decision**: add a real `page.tsx` for every one of these routes, rendering a new shared `NotYetAvailable` component (`components/shell/not-yet-available.tsx`) with a specific, accurate reason per route (backend-dormant vs. backend-live-but-frontend-reserved-for-M23). `ContextHeader` (built in M22.2, uninstantiated until now) is `NotYetAvailable`'s title element.

**Consequences**: every real link in the shell now goes somewhere real and honest. This is deliberately not feature work — no domain logic, no forms, no data fetching was added; it is the minimum content a route needs to stop being either broken or silently wrong.

**Alternatives considered**: removing the nav items/links that have no real page yet (rejected — several, like Campaigns and Companies, are `status: 'live'` because their *backend* is real and live; hiding them would misrepresent backend readiness, which `NAV_ITEMS.status` is specifically tracking); a single catch-all `not-found` page instead of one per route (rejected — a catch-all can't state each route's specific, real reason, which is the entire point of this fix).

---

### ADR-009: Route-level role protection is enforced in `AppShell`, reusing the Sidebar's own `NAV_ITEMS` role table

**Context**: `/admin` was hidden from non-admin users only by `visibleNavItems()` filtering it out of the rendered Sidebar list — nothing stopped a non-admin from typing the URL directly. The Security Audit's explicit "Route Protection" question exposed this as a real, if currently low-severity, gap (there's no real admin data to leak yet, but the gap itself is structural).

**Decision**: `lib/navigation.ts` gained `findNavItemForPath()`, and `AppShell` uses it to look up the current route's `NAV_ITEM` and check the authenticated user's role against it, rendering `NotYetAvailable`'s "Access restricted" state instead of `children` when the role doesn't match. This reuses the exact same `roles` table the Sidebar already uses to decide what to show — one source of truth for "who can see this," not two.

**Consequences**: direct navigation to a role-restricted route no longer silently succeeds. This is still not a real security boundary by itself (a determined user can read client-side JS) — the backend's own guards remain the actual boundary, exactly as `docs/frontend-architecture/08-permission-matrix.md`'s "hidden ≠ secured" principle already states — but it closes the gap between what the UI implies is restricted and what navigation actually enforces, which is a real, user-facing correctness property independent of the security boundary question.

**Alternatives considered**: enforcing this in `middleware.ts` instead (rejected — middleware only has the coarse, non-httpOnly session-presence cookie, not the decoded role; the role only exists in the client-side Zustand store, same reason the auth guard itself lives in `AppShell` rather than middleware, per ADR-002).

---

### ADR-010: `DropdownMenu`'s root element is a `div`, not a `span`

**Context**: `DropdownMenuContent` renders a block-level `role="menu"` `<div>`. The root `DropdownMenu` wrapped both trigger and content in `<span className="relative inline-block">` — a `<span>`'s content model is phrasing content only, so nesting a `<div>` inside it is invalid HTML, present at every one of this component's six-plus call sites in the shell.

**Decision**: change the wrapper to a `<div className="relative inline-block">`. `inline-block` display keeps the exact same layout behavior in a flex row as the `<span>` had, so this is a zero-visual-change fix.

**Consequences**: every dropdown in the shell (Notifications, Theme Switcher, Workspace Switcher, Quick Actions, Profile Menu, Background Activity Center) is now valid HTML at its root, fixed once at the shared primitive rather than six times at each call site.

**Alternatives considered**: none — this is a straightforward correctness fix with no real tradeoff.

---

### ADR-011: `DropdownMenuContent`/`DropdownMenuItem` restore focus to the trigger on close, matching a claim the code already made

**Context**: `DropdownMenuContent`'s own code comment stated Escape "returns focus to the trigger" — it didn't. Closing the menu unmounts its content; since a menuitem was focused at that point (the APG auto-focus-first-item behavior), the browser drops focus to `<body>` when that element leaves the DOM, silently breaking a keyboard user's position on the page. The same gap existed for a non-navigating item selection (Log out, Retry, a theme change) for the identical reason.

**Decision**: `DropdownMenu`'s context now tracks a `triggerRef` (populated via the existing asChild `cloneElement`, merged with any ref the caller already attached so neither is silently dropped). Both the Escape handler and `DropdownMenuItem`'s non-`href` `onSelect` path call `triggerRef.current?.focus()` after closing. `href` items deliberately don't — a real navigation should hand focus to the destination page, not fight it by forcing focus back to a trigger that's about to unmount anyway.

**Consequences**: closing any of the shell's six-plus dropdowns via Escape or a non-navigating action now returns a keyboard user to exactly the control they opened, matching the actual WAI-ARIA APG menu pattern this component has claimed to implement since M22.2.

**Alternatives considered**: none — this closes a real, verified gap between the component's own documentation and its behavior.

---

### ADR-012: `Card`'s `interactive` prop is documented as mutually exclusive with an already-interactive wrapper

**Context**: the Dashboard root page (`app/(dashboard)/page.tsx`) wrapped `<Card interactive>` inside a real `<Link>` — `interactive` sets `tabIndex={0}` on the Card's own `<div>`, producing the same double-focusable defect class M22.2 already fixed once in `DropdownMenuTrigger` (two separately-tabbable elements doing one job), just in a different component.

**Decision**: fixed the one real occurrence (visual hover treatment now applied via Tailwind's `group`/`group-hover:` on the wrapping `<Link>` instead of `Card`'s `interactive` prop), and added a doc comment on `CardProps.interactive` stating explicitly when to use it (a Card that owns its own click handling) versus when not to (a Card already nested inside a real interactive wrapper).

**Consequences**: no other call site in the codebase has this pattern today (verified by search). The doc comment is the durable fix — it's what stops the next Card+Link pairing from reintroducing the same bug a third time.

**Alternatives considered**: making `Card` detect its own ancestry and suppress `tabIndex` automatically (rejected — not reliably possible from within the component itself, and adds real complexity for a problem a one-line doc comment and correct call-site usage already solve).

---

### ADR-013: `Skeleton` resolves its color through a real `--color-skeleton` token instead of Tailwind's `dark:` variant

**Context**: every other component in the library resolves color through the CSS-custom-property/semantic-token layer described in ADR-005 ("zero component-level branching"). `Skeleton` was the one exception, hardcoding `bg-neutral-200 dark:bg-neutral-800` directly.

**Decision**: added `--color-skeleton` to `globals.css` (light: `--color-neutral-200`, dark: `--color-neutral-800` — identical values, just named and resolved through the token layer) and a matching `skeleton` entry in `tailwind.config.ts`'s color map. `Skeleton` now uses `bg-skeleton`.

**Consequences**: zero visual change; the codebase now has no remaining use of Tailwind's `dark:` variant anywhere, meaning exactly one mechanism (the `data-theme` attribute + CSS custom properties) governs every themed value in the product, with no second, parallel mechanism to keep consistent with the first.

**Alternatives considered**: reusing an existing token like `--color-border-default` instead of adding a new one (rejected — its light/dark values don't match Skeleton's actual, already-shipped visual appearance; introducing a dedicated token preserves the existing look exactly rather than silently changing it).

---

### ADR-014: The `gje_session` marker cookie sets `Secure` when served over HTTPS

**Context**: `auth-store.ts`'s non-httpOnly session-presence cookie (ADR-002) never set `Secure`, meaning in a production HTTPS deployment it would still be transmissible over a downgraded HTTP connection if one ever occurred.

**Decision**: `setSessionCookie()` now appends `; secure` when `location.protocol === 'https:'`, and omits it otherwise (a `Secure` cookie set from a plain-HTTP origin is rejected outright by browsers, which would break local development).

**Consequences**: a real, if narrow, hardening — this cookie already carries "zero security weight" by design (ADR-002), so the practical impact is small, but there's no reason not to close it now that it was found, and it costs nothing else that's guarded on protocol detection already used elsewhere (`typeof document === 'undefined'` guards throughout this file follow the same environment-detection pattern).

**Alternatives considered**: none — a strict improvement with no real tradeoff.
