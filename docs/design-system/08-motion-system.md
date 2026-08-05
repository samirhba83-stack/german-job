# 8. Motion System

## The rule every animation in this product must pass

Restated from [M20 §11](../frontend-architecture/11-design-system-foundation.md) and [Design Principle 11](02-design-principles.md), given its full specification here: **if a proposed animation doesn't communicate a state change, it doesn't ship.** Every pattern below names the specific state it communicates — there is no "decorative flourish" category in this system.

## By interaction type

### Page transitions
**Communicates**: navigation occurred. **Treatment**: content fades/slides in at `motion-base`/`ease-entrance` ([§3](03-design-tokens.md)) — no full-page slide/zoom transitions (too slow for a data tool used repeatedly all day; per-region content transitions, not whole-viewport ones). The app shell (Sidebar/Top Navigation, [M20 §4](../frontend-architecture/04-dashboard-architecture.md)) never re-animates on navigation — only the content region does, reinforcing that the shell is a stable, persistent frame.

### Hover
**Communicates**: this element is interactive. **Treatment**: `motion-fast`/`ease-standard` — background/border/shadow shift only (per-component specs in [§7](07-component-library.md)), never a scale/transform change (scale-on-hover reads as playful/consumer-app, inconsistent with [§1's](01-design-philosophy.md) professional register).

### Loading
**Communicates**: content is being fetched. **Treatment**: Loading Skeleton's shimmer ([§7](07-component-library.md)) at `motion-slow`, or a Button's inline spinner at a continuous rotation — never a progress bar with no real value behind it ([M20's absolute rule](../frontend-architecture/11-design-system-foundation.md), reused verbatim here).

### Success
**Communicates**: an action completed as expected. **Treatment**: a Toast entrance (`motion-base`/`ease-entrance`, [§7](07-component-library.md)), plus — for [Product Experience's Delight Moments](../product-experience/13-delight-moments.md) specifically — one restrained additional beat (a brief, single-pulse accent on the confirming element, never confetti/particles/sound, per [Product Experience UX-DR-007](../product-experience/16-ux-decision-records.md)'s explicit ceiling).

### Error
**Communicates**: an action failed, or a validation constraint wasn't met. **Treatment**: a brief horizontal shake (2 cycles, ~150ms total) on the specific failing element (a form field) — reserved exclusively for validation errors the user can immediately fix; a failed async mutation (network/server error, [Product Experience's Error Experience](../product-experience/11-error-experience.md)) uses the Alert/Toast entrance instead, never the shake (shake implies "try again right here, right now," which is honest for a validation error and misleading for a failure that needs a different kind of retry).

### Timeline updates
**Communicates**: a new real event was recorded. **Treatment**: a new Timeline entry ([§7](07-component-library.md)) enters via `motion-base`/`ease-entrance` from the top (or wherever new entries append), with a brief highlight fade (background flashes `opacity-hover-overlay` then fades to transparent over `motion-slow`) — draws the eye to what's new without being alarming, appropriate for [Product Experience's calm Emotional Journey](../product-experience/02-emotional-journey.md) treatment of status changes.

### Mission Control updates
**Communicates**: real, live execution data changed (per [M20's one narrow live-polling exception](../frontend-architecture/06-api-consumption-architecture.md) — `execution-status` while `RUNNING`). **Treatment**: numeric values use a brief count-up/count-down transition (`motion-slow`) when they change, rather than snapping instantly — communicates "this moved" without implying anything faster or more dramatic than what actually happened. **Hard rule, restated a third time across this document set because it's the single highest-risk motion pattern in the product**: this treatment is used *only* on confirmed real data changes from a real poll response — never as an idle "breathing"/pulsing animation implying background activity, which would fabricate exactly the kind of activity [Career Intelligence](../career-intelligence/README.md) and [M20](../frontend-architecture/02-user-journeys.md) both explicitly warn against for the still-dormant execution pipeline.

### Map updates (Germany Coverage Map, once live)
**Communicates**: verified company-location data changed. **Treatment**: a newly-active region highlights with a brief fade-in (`motion-base`) — never an animated "spreading" or "radar sweep" effect, which would visually imply estimation/coverage the platform doesn't have (directly enforced by [M19's "never estimate location" rule](../M19-VALIDATION-REPORT.md), carried into motion design here).

## Universal constraints

- **`prefers-reduced-motion` compliance is absolute** ([M20 §11](../frontend-architecture/11-design-system-foundation.md)): every pattern above has a reduced-motion equivalent that's an instant state change with no easing/duration — the *information* conveyed (something changed) is preserved; only the *animated transition* is removed.
- **No continuous ambient motion anywhere**, regardless of setting — no idle pulsing, no floating decorative elements, no auto-playing background animation. This is an operational tool used for hours at a time; continuous motion is fatiguing, not delightful, at that usage pattern.
- **Duration scale is closed** — only `motion-fast`/`motion-base`/`motion-slow` ([§3](03-design-tokens.md)) are ever used; no component introduces a bespoke duration value.
