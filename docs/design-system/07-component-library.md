# 7. Component Library

## No duplicate definitions — how this document is structured

[M20 §5](../frontend-architecture/05-component-architecture.md) already defined the *functional contract* (Inputs, Outputs, States, Variants, Accessibility, Reuse strategy) for a first set of components. Redefining those contracts here would violate this milestone's explicit constraint. Instead: **Part A** gives those existing components only what M20 didn't — their real visual specification (which tokens from §3/§4/§6 apply). **Part B** gives full contracts (M20's exact template, since it's the established, working format) to components this milestone introduces that M20 never defined.

---

## Part A — Visual specification for M20's existing components (contracts unchanged, see M20 §5)

### Button
Radius `radius-md`. Primary: `indigo-600` fill, `text.inverse` label, `elevation-0` at rest → `elevation-1` on hover. Secondary: `surface.default` fill, `border.default` outline. Ghost: transparent, `text.primary`, `opacity-hover-overlay` fill on hover. Destructive: `status-critical` fill, used only per [Product Experience's restraint rule](../product-experience/16-ux-decision-records.md). Height: 36px (`md`), 32px (`sm`), 44px (`lg`, meets the 44×44px touch-target minimum [M20 §10](../frontend-architecture/10-ux-principles.md) already requires). Label: `text-body` weight 600.

### Input / Textarea / Select
Radius `radius-md`, `border.default` at rest → `border.focus` (2px, `indigo-600`) on focus, `status-critical` border + icon on error. Height 36px (single-line). Label: Labels treatment ([§4](04-typography-system.md)). Placeholder: `text.disabled`.

### Card
`surface.default`, `radius-lg`, `elevation-1` at rest, `elevation-2` on hover when `interactive`. Padding `space-4` (compact) or `space-6` (spacious) per [§5's](05-grid-system.md) whitespace strategy.

### Status Badge
`radius-full`, `text-caption` weight 600, background = semantic token at 12% opacity, text/icon = semantic token at full opacity (ensures the badge itself always passes contrast against its own background regardless of theme — a fixed relationship, not tuned per instance).

### Progress Components (bar/circular)
Track: `neutral-200` (light) / `neutral-700` (dark). Fill: `indigo-600`, or the relevant semantic token when progress represents a status rather than a neutral value (e.g. a goal-progress bar nearing a risk threshold could use `status-warning`). Animated fill transitions use `motion-base`/`ease-standard` ([§3](03-design-tokens.md)) — never used to fake unknown progress ([M20 §11](../frontend-architecture/11-design-system-foundation.md), restated in [§8](08-motion-system.md)).

### Data Table / Data Grid
Header row: `background.subtle`, Tables-role type ([§4](04-typography-system.md)). Row border: `border.subtle`. Row hover: `opacity-hover-overlay` fill. Numeric columns: `tabular-nums` ([§4](04-typography-system.md)), right-aligned.

### Timeline
Connector line: `border.default`, 2px. Node: 8px circle, filled with the entry's semantic tone. Entry spacing: `space-6` vertical rhythm ([§5](05-grid-system.md)).

### Dialog ("Modal")
`surface.overlay`, `radius-lg`, `elevation-3`, entrance/exit via `motion-base`/`ease-entrance`/`ease-exit` ([§3](03-design-tokens.md), [§8](08-motion-system.md)). Scrim: `opacity-scrim` token.

### Drawer
Same surface/elevation treatment as Dialog; slides in from `side` prop using `motion-base`.

### Form
No visual identity of its own — inherits entirely from the Input/Button specs above; its only visual contribution is `space-4` vertical rhythm between fields ([§5](05-grid-system.md)).

### Search / Filter Bar
Input spec above, plus filter chips using the Status Badge visual spec at `status-neutral` tone with a dismiss icon ([§6](06-iconography.md)).

### Pagination
Buttons use the Button ghost variant at `sm` size; current page uses the Button primary variant.

### Notification Center panel
`surface.raised`, `elevation-2`, list rows using the Activity Feed visual pattern (Part B, below).

---

## Part B — New components (full contract, M20's template)

### Dropdown (menu)
**Purpose**: a triggered popover menu of actions or options — distinct from Select (a form field, M20) in that a Dropdown's items are actions or a filter's option list, not necessarily a single form value.
**Variants**: action menu (icon-trigger, e.g. a row's "⋯" menu), filter dropdown (label-trigger).
**States**: closed, open, item-hover, item-disabled.
**Accessibility**: `role="menu"`/`menuitem`, full arrow-key navigation, `Escape` closes and returns focus to the trigger.
**Interactions**: opens on click or `Enter`/`Space` on the trigger; closes on selection, `Escape`, or an outside click.
**Visual**: `surface.raised`, `radius-md`, `elevation-2`, entrance via `motion-fast`.
**Reuse strategy**: backs every row-level action menu across every table/list screen in [M20's inventory](../frontend-architecture/03-screen-inventory.md).

### Statistic Card
**Purpose**: a single headline number with context — the primary building block of [M20's Dashboard widgets](../frontend-architecture/04-dashboard-architecture.md) and [Career Intelligence's Personal Success Analytics](../career-intelligence/03-personal-success-analytics.md).
**Variants**: simple (number + label), trend (number + change indicator), evidence-linked (number + a link to the underlying data).
**States**: loading (skeleton), populated, insufficient-data (per [Career Intelligence's minimum-sample rule](../career-intelligence/03-personal-success-analytics.md) — shows raw counts, not a fabricated ratio).
**Accessibility**: the number is real text (never an image/canvas render), so it's screen-reader legible and user-zoomable.
**Visual**: Card spec + Numbers typography role ([§4](04-typography-system.md)) at `text-heading-lg` size for the headline figure.
**Reuse strategy**: every rate/count shown anywhere in [Career Intelligence's Analytics](../career-intelligence/03-personal-success-analytics.md) or [Personal Growth Dashboard](../career-intelligence/08-personal-growth-dashboard.md).

### Progress Card
**Purpose**: a Card composing a Progress bar with contextual labeling — the visual home for a campaign's real goal-progress ([M20's `execution-status` data](../frontend-architecture/06-api-consumption-architecture.md)).
**Variants**: linear, circular (compact).
**States**: same as Progress Components, plus a completed state (`status-positive` fill).
**Visual**: Card spec + Progress Component spec.
**Reuse strategy**: Campaign Detail's execution-status tab, Dashboard summary cards.

### Activity Feed
**Purpose**: a chronological feed of heterogeneous real events — distinct from Timeline (Part A), which shows one resource's own structured lifecycle; Activity Feed mixes event types (a reply, a status change, a milestone) in one stream, the pattern behind [M20's Recent Application Activity widget](../frontend-architecture/04-dashboard-architecture.md) and the eventual [Notification Center](../product-experience/09-notification-strategy.md).
**Variants**: compact (dashboard widget), full (dedicated feed screen).
**States**: loading, empty (per [Product Experience's Empty State Philosophy](../product-experience/10-empty-state-philosophy.md)), populated.
**Accessibility**: `aria-live="polite"` region when new items can arrive without a page reload.
**Visual**: each row = icon (semantic-toned per [§6](06-iconography.md)) + `text-body-sm` description + `text-caption` timestamp.
**Reuse strategy**: Dashboard, Notification Center panel, Personal Growth Dashboard's "Recent Improvements."

### Alert
**Purpose**: a page- or section-level message — distinct from Toast (transient, corner-positioned) and from Status Badge (inline, compact). An Alert stays visible until dismissed or its condition resolves.
**Variants**: info, warning, critical, success — using the exact §3 semantic tokens, always paired with the matching semantic icon ([§6](06-iconography.md)), never color alone.
**States**: default, dismissible (shows a close action), non-dismissible (for conditions the user can't make go away by dismissing, e.g. "delivery isn't available right now" per [Product Experience's Error Experience](../product-experience/11-error-experience.md)).
**Accessibility**: `role="alert"` for critical/warning (interrupts screen-reader flow appropriately), `role="status"` for info/success.
**Visual**: full-width within its container, `radius-md`, background = semantic token at 8% opacity, left border accent = semantic token at full opacity.
**Reuse strategy**: the visual home for every "not yet available" honesty state this whole document set has required since M20 (dormant Mission Control, unbuilt Notifications, the unguarded Billing endpoint's production-readiness gate).

### Toast
**Purpose**: a transient, corner-positioned confirmation — success/failure feedback for an action just taken (per [Product Experience's Success/Error message tone](../product-experience/08-ai-communication-style.md)).
**Variants**: success, error, info — same semantic tokens as Alert, smaller footprint.
**States**: entering, visible, exiting, (optionally) action-attached (e.g. an "Undo" — see [Product Experience's UX-DR on undo](../product-experience/16-ux-decision-records.md): only ever shown where a real reversal exists, e.g. Company archive/restore).
**Accessibility**: `aria-live="polite"`, auto-dismiss timing long enough to be read (minimum 5s), never the sole record of an outcome (the underlying data change is always separately visible/queryable — a missed toast never means missed information).
**Visual**: `surface.raised`, `elevation-2`, `radius-md`, stacks vertically when multiple are active, entrance/exit via `motion-base`.
**Reuse strategy**: every mutation across the entire product surface.

### Wizard
**Purpose**: a multi-step, linear flow container — the pattern behind [M20's Onboarding Wizard and Campaign Create Wizard](../frontend-architecture/03-screen-inventory.md), never previously given its own component spec.
**Variants**: linear (must complete steps in order), free-navigation (can jump between completed steps).
**States**: per-step (pristine/active/complete/error), overall (in-progress/complete).
**Accessibility**: step indicator uses `aria-current="step"`, not color alone to indicate the active step.
**Visual**: step indicator uses Status Badge–style dots/labels; step content area uses standard Card/Form spacing.
**Reuse strategy**: Onboarding, Campaign Create.

### Tabs
**Purpose**: lateral, same-hierarchy-level content switching within one screen — the pattern [M20's navigation architecture](../frontend-architecture/09-navigation-architecture.md) already specified as route-segment-backed (Campaign Detail's Overview/Timeline/Health/Execution tabs), never given a visual component spec until now.
**Variants**: underline (default), pill (for a small, closed set of options).
**States**: active, inactive, disabled.
**Accessibility**: `role="tablist"`/`tab`/`tabpanel`, arrow-key navigation between tabs.
**Visual**: active tab underline = `indigo-600`, 2px; inactive tab label = `text.secondary`.
**Reuse strategy**: Campaign Detail, Application Detail, any future multi-facet detail screen.

### Accordion
**Purpose**: progressive disclosure for content that's secondary to a screen's primary purpose — e.g. a Decision Explanation's full evidence detail ([§12](12-ai-visual-language.md)) collapsed by default, expandable on demand.
**Variants**: single-open, multi-open.
**States**: collapsed, expanded, disabled.
**Accessibility**: `aria-expanded` on the trigger, content region has a matching `id` referenced via `aria-controls`.
**Visual**: chevron icon rotates on expand ([§6](06-iconography.md)), content entrance via `motion-base`.
**Reuse strategy**: Decision Explanation blocks ([§12](12-ai-visual-language.md)), FAQ-style content, any secondary-detail disclosure.

### Tooltip
**Purpose**: brief, supplementary context on hover/focus — never the sole location of information required to use a control (that's always a visible label, per Design Principle 4).
**Variants**: default (text only), rich (small structured content — reserved for confidence/evidence micro-previews, [§12](12-ai-visual-language.md)).
**States**: hidden, visible.
**Accessibility**: triggered by both hover *and* focus (keyboard-reachable), dismissible via `Escape`, never the only way to access its content (a rich tooltip's content is always also reachable via a click-through to full detail).
**Visual**: `surface.raised` (dark-on-light or light-on-dark, whichever contrasts more against the trigger's context), `radius-sm`, `elevation-2`, `text-caption`.
**Reuse strategy**: confidence-score explanations, truncated text, icon-only button labels.

### Avatar
**Purpose**: represents a user or company — profile photo, company logo, or a generated initial-based fallback.
**Variants**: circular (users), rounded-square (companies — visually distinguishes person from organization at a glance without needing a label).
**States**: image-loaded, fallback (initials on a deterministic background color derived from the entity's id — never random per render, so the same entity always gets the same fallback color).
**Accessibility**: `alt` text naming the person/company, never just "avatar."
**Visual**: sizes `sm`(24px)/`md`(32px)/`lg`(48px), `radius-full` (user) or `radius-md` (company).
**Reuse strategy**: Top Navigation user menu, company cards, application rows.

### Loading Skeleton
**Purpose**: the shape-matching loading pattern [M20 §10](../frontend-architecture/10-ux-principles.md) already mandates as the default loading treatment — given its own component spec here since this milestone requires one.
**Variants**: text-line, card, table-row, avatar — each matching the exact dimensions of the content it stands in for.
**States**: animating (a subtle shimmer, `motion-slow`, respects `prefers-reduced-motion` by switching to a static pulse instead of a moving shimmer), resolved (replaced by real content, never cross-fades in a way that could be mistaken for content actually changing).
**Accessibility**: `aria-busy="true"` on the containing region while skeletons are present.
**Visual**: `neutral-100`/`neutral-800` (dark) fill.
**Reuse strategy**: universal — every content-shaped loading state across the entire product.

### Charts
**Purpose**: visualizing real trend/comparison data — [Career Intelligence's](../career-intelligence/README.md) Historical Trends, [Progress Psychology's](../product-experience/05-progress-psychology.md) funnel, regional/industry breakdowns.
**Variants**: line (trends over real time), bar (comparisons across categories), funnel (the Companies-Analyzed→Interview funnel).
**States**: loading, populated, insufficient-data (per [Career Intelligence's evidence gate](../career-intelligence/04-pattern-detection-blueprint.md) — a chart never renders a trend line from below-threshold data; it shows the raw points or an explicit "not enough data yet" state instead).
**Accessibility**: every chart ships with a text-equivalent data table alternative (never chart-only data — critical since a chart alone fails screen-reader users entirely), and never relies on color alone to distinguish series (pattern/shape differentiation too).
**Visual**: `indigo-600` for the primary series, `neutral-400` for comparison/secondary series, semantic tokens only when a series genuinely represents a status.
**Reuse strategy**: Career Intelligence's Long-term Trends widget, Personal Success Analytics.

### Mission Control Widgets
**Purpose**: the widget family backing [M20's Mission Control screens](../frontend-architecture/03-screen-inventory.md) — Execution Cards, Confidence Indicators, Recommendation Cards, Decision Reports. Full visual treatment specified in [§11 Mission Control Visual Language](11-mission-control-visual-language.md), rather than restated here — this entry exists so the component inventory is complete, cross-referenced rather than duplicated.

### Career Intelligence Widgets
**Purpose**: the widget family backing [Career Intelligence's](../career-intelligence/README.md) Career Health dimensions, confidence bands, and pattern cards — the exact new component needs [Career Intelligence's own readiness assessment](../career-intelligence/13-risks-and-future-extensibility.md) flagged for this milestone. Full visual treatment in [§12 AI Visual Language](12-ai-visual-language.md) (confidence/evidence presentation) and [§11](11-mission-control-visual-language.md) (Career Health Widgets specifically).
