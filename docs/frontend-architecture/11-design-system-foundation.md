# 11. Design System Foundation

No visual design here — token *structure* only, so implementation can start without a future redesign. The scaffold already has Tailwind CSS installed (`apps/web/package.json`); everything below is expressed as Tailwind-config-shaped tokens so it maps directly onto the existing toolchain rather than introducing a second styling system.

## Design tokens: the structural rule

Every visual value used anywhere in the product traces back to a named token — no raw hex codes, no magic pixel values, no ad hoc `font-size: 15px` in a component. This is the same "no duplicated logic" discipline the backend charter applies to code (see the Engineering Standards memory this project has followed since M1), applied to design values instead.

```
tokens/
├── color.ts          # semantic color tokens (§ Color Token Structure)
├── spacing.ts         # § Spacing System
├── typography.ts      # § Typography Scale
├── elevation.ts        # § Elevation Rules
├── radius.ts
├── breakpoints.ts      # § Responsive Breakpoints
└── motion.ts           # § Animation Principles
```

## Spacing system

An 8px base unit, exposed as a numeric scale (matches Tailwind's default spacing convention, so no config remapping is needed — a deliberate choice to avoid fighting the toolchain):

| Token | Value | Typical use |
|---|---|---|
| `space-1` | 4px | icon-to-label gap |
| `space-2` | 8px | tight internal padding |
| `space-3` | 12px | form field internal padding |
| `space-4` | 16px | card internal padding, base gap |
| `space-6` | 24px | section spacing |
| `space-8` | 32px | page-section gaps |
| `space-12` | 48px | major layout divisions |
| `space-16` | 64px | page-level top/bottom margins |

Layout components (04's Shell, 05's Card) use `gap`, never per-child margin (matches the artifact-design discipline already established elsewhere in this project: layout does the spacing, not individual elements — avoids the classic collapsing/doubling-margin bug).

## Typography scale

Two-role type system: one face for UI/body text (optimized for density and legibility at small sizes — this product is data-dense: tables, timelines, status lists), one for display/headings (a touch more character, used sparingly). Exact typeface selection is a visual-design decision deferred past this milestone (see OQ-16) — what's fixed now is the *scale* and *role separation*, so implementation doesn't have to guess later:

| Token | Size | Line height | Role |
|---|---|---|---|
| `text-display` | 32px | 1.2 | Page titles (Campaign Detail's name, Dashboard greeting) |
| `text-heading-lg` | 24px | 1.3 | Section headings |
| `text-heading-md` | 18px | 1.4 | Card titles, dialog titles |
| `text-body` | 15px | 1.5 | Default UI text — chosen slightly denser than a marketing site's 16px baseline, matching this product's data-dense screens (Application/Campaign detail, tables) |
| `text-body-sm` | 13px | 1.5 | Secondary text, timestamps, helper text |
| `text-caption` | 12px | 1.4 | Badge labels, table headers |
| `text-mono` | 13px | 1.5 | Ids, correlation/trace ids (Trust Center, 🟡) — a monospace role reserved specifically because this platform's own event data is identifier-heavy |

## Grid system

12-column, responsive gutters (`space-4` mobile, `space-6` desktop), max content width of 1440px on the widest breakpoint with centered gutters beyond it (this is a data-dense operational product, not a marketing site chasing ultra-wide hero layouts — the max-width exists to keep tables and timelines from stretching into unreadable line lengths, not for aesthetic framing).

## Component hierarchy

Directly follows [05-component-architecture.md](05-component-architecture.md)'s three tiers (Primitives → Composites → Feature components) — the design system's job is to make sure every tier's visual language is token-derived so a Feature component never has a bespoke shadow/radius/color that a Primitive doesn't also use. No separate "design system hierarchy" is introduced; it's the same hierarchy, viewed from the token-application side rather than the component-contract side.

## Elevation rules

Four levels, used semantically (elevation communicates layering, not decoration):

| Token | Use |
|---|---|
| `elevation-0` | Flat — page background, most Cards at rest |
| `elevation-1` | Raised — an `interactive` Card on hover (05), a dropdown |
| `elevation-2` | Floating — Drawer |
| `elevation-3` | Modal — Dialog (05), always the topmost layer, always paired with a scrim |

## Color token structure

Semantic tokens, never raw palette references in component code:

```
color.background.{default, subtle, inverse}
color.surface.{default, raised, overlay}
color.border.{default, subtle, focus}
color.text.{primary, secondary, disabled, inverse}
color.accent.{default, hover, active}          # brand accent — used sparingly, see 10 UX principle on honesty extended to visual weight: don't let decorative color compete with status color
color.status.{neutral, positive, warning, critical, info}   # semantic — backs every Status Badge tone (05)
```

**Status tokens are the single source of truth** for every domain enum's visual mapping (`CampaignStatus`, `ApplicationLifecycleStatus`, `JobStatus`, `SubscriptionStatus` — 05, 08). No screen picks its own "green for good" color; every status-to-tone mapping resolves through these five tokens, so a future palette change never requires touching feature code.

## Dark mode readiness

Every color token above is defined as a pair (`light`/`dark` value) from day one, resolved via a CSS custom-property layer (`:root` + `[data-theme="dark"]` override — the same pattern this project's own Artifact tooling already uses, kept consistent rather than inventing a second convention) so dark mode is a token-resolution concern, never a component-level `if (theme === 'dark')` branch anywhere in application code. Components only ever reference the semantic token name; they are theme-agnostic by construction.

## Animation principles

- **Purposeful only** — motion communicates state change (a Dialog entering, a skeleton resolving into content, a status transitioning), never decorates.
- **Respect `prefers-reduced-motion`** — every transition/animation has a reduced-motion fallback (instant state change, no continuous ambient motion anywhere in the product regardless of setting — this is an operational tool, not a marketing experience).
- **Duration scale**: `motion-fast` (100ms, hover/focus feedback), `motion-base` (200ms, most transitions — Dialog/Drawer enter/exit, tab switches), `motion-slow` (350ms, page-level transitions only, used sparingly).
- **No animation stands in for real data** — directly enforces [10-ux-principles.md](10-ux-principles.md) principle 12: an indeterminate spinner must never be used where the backend actually returns a real progress value (05, Progress Components), because that would be motion manufacturing an impression of activity the data doesn't support.

## Responsive breakpoints

Mobile-first, four breakpoints (Tailwind's default scale, again chosen to avoid fighting the toolchain):

| Token | Width | Primary shift |
|---|---|---|
| `sm` | 640px | Single-column → two-column forms |
| `md` | 768px | Sidebar becomes a persistent rail instead of a Drawer (09, 04) |
| `lg` | 1024px | Data Tables show full column sets instead of degrading to stacked cards (10) |
| `xl` | 1280px | Multi-widget Dashboard grid reaches full layout (04) |

This foundation is intentionally silent on final color values, exact typeface, or icon set — those are visual-design decisions for a follow-up pass, deliberately deferred (per the milestone's own instruction not to implement visual design yet) so this document can't accidentally become stale the moment a brand decision is made. What it fixes — token *names*, the *scale*, the *semantic/decorative color separation*, and *dark-mode-as-token-resolution* — is exactly the set of decisions that would force a redesign if skipped now and decided ad hoc later.
