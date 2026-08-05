# 3. Design Tokens

## What's new here vs. what's already fixed

[M20 §11](../frontend-architecture/11-design-system-foundation.md) fixed token *names*, *structure*, and *scale relationships* — spacing (`space-1`…`space-16`), the typography scale's sizes/line-heights, the 12-column grid, elevation *levels* (0–3) and their semantic use, dark-mode-as-token-resolution, and breakpoints `sm`/`md`/`lg`/`xl`. **None of that is redefined here.** This document assigns the real values M20 explicitly deferred — actual colors, actual shadow specs, actual radii, actual opacity/easing values — and extends two areas M20 left genuinely open: large-screen breakpoints and a formal radius/opacity scale.

## Why Tailwind's default palette, not invented hex values

Built on Tailwind's own professionally-vetted color scales rather than hand-picked hex codes — the same "don't fight the toolchain" reasoning [M20](../frontend-architecture/11-design-system-foundation.md) already applied to spacing and breakpoints, extended to color. Tailwind's scales have known, well-tested contrast characteristics across their full range, which materially de-risks the accessibility commitments in [§9](09-accessibility.md) compared to inventing an unvetted custom palette.

## Primary color

**Indigo** — `indigo-600` (`#4F46E5`) light mode, `indigo-400` (`#818CF8`) dark mode.

**Rationale**: reads as intelligent and premium without being a decorative gradient (the specific pattern [§1](01-design-philosophy.md) already commits to avoiding) — used flat, and only on interactive elements. Distinct enough from the `sky` family reserved for the Info semantic color (below) that the two are never confused despite both being cool-toned — indigo leans visibly violet, sky leans visibly cyan, and they're never adjacent in the same UI region. Contrast of `indigo-600` on white: ≈6:1, passing WCAG AA for both normal text and UI components.

**Usage discipline** (enforces [Design Principle 9](02-design-principles.md)): primary buttons, active nav items, focus rings, links, primary-CTA-only. Never used for decoration, backgrounds, or anything that isn't an interactive affordance.

## Neutral scale

Tailwind's `slate` family — cool-neutral (slight blue undertone), pairs deliberately with the indigo accent rather than clashing with it the way a warm/amber-tinted gray would.

| Token | Hex | Typical use |
|---|---|---|
| `neutral-50` | `#F8FAFC` | Page background (light) |
| `neutral-100` | `#F1F5F9` | Subtle background, hover fill |
| `neutral-200` | `#E2E8F0` | Default border |
| `neutral-300` | `#CBD5E1` | Stronger border, disabled fill |
| `neutral-400` | `#94A3B8` | Placeholder text, disabled text |
| `neutral-500` | `#64748B` | Secondary text |
| `neutral-600` | `#475569` | Secondary text (dark mode primary-adjacent) |
| `neutral-700` | `#334155` | Primary text (light mode, softer than 900) |
| `neutral-800` | `#1E293B` | Surface (dark mode raised) |
| `neutral-900` | `#0F172A` | Primary text, page background (dark mode) |
| `neutral-950` | `#020617` | Deepest dark-mode background |

## Semantic colors

| Token | Light | Dark | Rationale |
|---|---|---|---|
| `status-positive` (success) | `emerald-600` `#059669` | `emerald-400` `#34D399` | Green reads success cross-culturally in this context; `emerald` chosen over pure `green` for a slightly cooler, more premium/less "traffic light" feel |
| `status-warning` | `amber-600` `#D97706` | `amber-400` `#FBBF24` | Standard warning association; always paired with an icon, never relies on color alone (§9) since amber-on-white contrast is more marginal at small text sizes |
| `status-critical` (danger) | `red-600` `#DC2626` | `red-400` `#F87171` | Reserved exclusively for destructive/failure states — never used decoratively, so its rare appearance stays meaningful (directly extends [Product Experience's restraint rule for the `destructive` Button variant](../product-experience/16-ux-decision-records.md)) |
| `status-info` | `sky-600` `#0284C7` | `sky-400` `#38BDF8` | Deliberately distinguished from the indigo primary accent (see above) — info banners/badges never risk being mistaken for a primary CTA |
| `status-neutral` | `neutral-500` `#64748B` | `neutral-400` `#94A3B8` | For a status that's neither good, bad, nor informational — e.g. `DRAFT`, `PENDING` |

This is the concrete fill for [M20's `color.status.{neutral, positive, warning, critical, info}` structure](../frontend-architecture/11-design-system-foundation.md) — the same five-token set, now with real values, still the single source of truth every domain enum (`CampaignStatus`, `ApplicationLifecycleStatus`, `JobStatus`, `SubscriptionStatus`) maps onto.

## Background, surface, and border levels (filling M20's structure)

| Token | Light | Dark |
|---|---|---|
| `background.default` | `neutral-50` `#F8FAFC` | `neutral-950` `#020617` |
| `background.subtle` | `neutral-100` `#F1F5F9` | `neutral-900` `#0F172A` |
| `background.inverse` | `neutral-900` `#0F172A` | `neutral-50` `#F8FAFC` |
| `surface.default` | `#FFFFFF` | `neutral-900` `#0F172A` |
| `surface.raised` | `#FFFFFF` (+ shadow, below) | `neutral-800` `#1E293B` |
| `surface.overlay` | `#FFFFFF` (+ scrim behind) | `neutral-800` `#1E293B` |
| `border.default` | `neutral-200` `#E2E8F0` | `neutral-700` `#334155` |
| `border.subtle` | `neutral-100` `#F1F5F9` | `neutral-800` `#1E293B` |
| `border.focus` | `indigo-600` `#4F46E5` | `indigo-400` `#818CF8` |
| `text.primary` | `neutral-900` `#0F172A` | `neutral-50` `#F8FAFC` |
| `text.secondary` | `neutral-500` `#64748B` | `neutral-400` `#94A3B8` |
| `text.disabled` | `neutral-400` `#94A3B8` | `neutral-600` `#475569` |
| `text.inverse` | `#FFFFFF` | `neutral-900` `#0F172A` |

## Shadow tokens (filling M20's `elevation-0`–`elevation-3` names)

Dark mode uses a different mechanism than "the same shadow, darker" — shadows are barely visible against a dark surface, so dark mode leans on a subtle `border.default` plus a reduced-opacity shadow rather than trying to darken an already-dark shadow further (a well-established dark-mode pattern, not an invented one).

| Token | Light value | Dark mode treatment |
|---|---|---|
| `elevation-0` | none | none |
| `elevation-1` | `0 1px 2px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.08)` | `border: 1px solid neutral-700` + shadow at 40% the light-mode opacity |
| `elevation-2` | `0 4px 8px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.06)` | Same border treatment + proportionally reduced shadow |
| `elevation-3` | `0 12px 24px rgba(15,23,42,0.14), 0 4px 8px rgba(15,23,42,0.08)` | Same pattern, plus the modal scrim (`rgba(15,23,42,0.5)` light / `rgba(2,6,23,0.7)` dark) does most of the separation work |

## Radius scale (new — M20 named a `radius.ts` file but never defined values)

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 4px | Badges, small inline elements |
| `radius-md` | 8px | Default — buttons, inputs, cards |
| `radius-lg` | 12px | Larger surfaces — modals, drawers |
| `radius-xl` | 16px | Rare — large feature cards only |
| `radius-full` | 9999px | Avatars, pill-shaped badges |

A moderate scale (8px default, not 4px or 16px) — enterprise-tool precision (Stripe/Linear-adjacent) reads through restrained, not heavily-rounded, corners; a consumer-app-style 16–24px default radius was deliberately rejected as inconsistent with [§1's](01-design-philosophy.md) "professional, premium" register.

## Opacity tokens (new)

| Token | Value | Use |
|---|---|---|
| `opacity-disabled` | 0.5 | Disabled interactive elements |
| `opacity-hover-overlay` | 0.08 | Hover-state fill over a base color |
| `opacity-pressed-overlay` | 0.12 | Active/pressed-state fill |
| `opacity-subtle` | 0.64 | De-emphasized but still-legible content |
| `opacity-scrim` | 0.5 (light) / 0.7 (dark) | Modal/drawer backdrop |

## Motion tokens (extending M20's duration scale with easing — M20 fixed durations, never defined curves)

| Token | Value |
|---|---|
| `motion-fast` | 100ms *(M20, unchanged)* |
| `motion-base` | 200ms *(M20, unchanged)* |
| `motion-slow` | 350ms *(M20, unchanged)* |
| `ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` — most transitions | 
| `ease-entrance` | `cubic-bezier(0, 0, 0.2, 1)` — elements entering (Dialog/Drawer/Toast appearing) |
| `ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` — elements leaving |

Full behavioral rules in [§8 Motion System](08-motion-system.md).

## Responsive breakpoints — M20's four, plus two new ones for large/ultra-wide screens

| Token | Width | Status |
|---|---|---|
| `sm` | 640px | M20, unchanged |
| `md` | 768px | M20, unchanged |
| `lg` | 1024px | M20, unchanged |
| `xl` | 1280px | M20, unchanged |
| `2xl` | 1536px | **New** — large laptop/small external display |
| `3xl` | 1920px | **New** — ultra-wide monitor: does not introduce a wider grid (M20's 1440px max-width, [§5](05-grid-system.md), still applies) — only governs side-gutter/padding scaling so content doesn't awkwardly hug one side of an ultra-wide viewport |

Full behavior in [§10 Responsive Strategy](10-responsive-strategy.md).
