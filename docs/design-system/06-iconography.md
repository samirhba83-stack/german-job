# 6. Iconography

## The icon set decision

**Lucide** — a consistent, stroke-based icon library (open-source, actively maintained, MIT-licensed) built on a uniform 24×24 grid.

**Rationale**: consistent stroke-based construction across its entire set (unlike mixed icon sets that blend filled and outlined styles inconsistently), a large enough library to cover this platform's full surface (status, navigation, actions, domain-specific concepts like documents/companies/timelines) without needing a second source, and direct compatibility with the Tailwind-centered toolchain [M20](../frontend-architecture/12-architecture-decision-records.md) already committed to (ADR-006) — Lucide is the de facto standard companion to exactly that stack, reducing integration risk to near zero.

## Stroke width

**1.75px** at the default 24×24 size (Lucide's own default is 2px; 1.75px is a deliberate, slight reduction) — reads as more refined and less "chunky" at the small sizes this UI uses most (16px and 20px renders, scaled down from the 24px source), consistent with [§1's](01-design-philosophy.md) "premium, minimal, elegant" register. Never mixed with a different stroke width from another source — if a needed icon doesn't exist in Lucide, the resolution is a custom-drawn icon matching Lucide's exact grid/stroke/corner-radius conventions, never a visually-inconsistent icon borrowed from elsewhere.

## Filled vs. outlined

**Outlined by default, everywhere.** Filled variants are reserved for exactly one purpose: indicating an active/selected/current state where an icon needs to visually "commit" (a selected nav item, a filled star for a saved/favorited item, a filled bell when notifications exist). This is a small, closed set of specific uses — never a general stylistic choice made per-screen. The outlined-by-default rule keeps the interface visually calm (Design Principle 4, minimal cognitive effort) — filled icons carry more visual weight, so reserving them for genuine "this is active/selected" moments keeps that weight meaningful.

## Meaning hierarchy

Three tiers, by how much weight an icon is allowed to carry:

1. **Functional icons** (chevrons, close/dismiss, search, filter) — always outlined, always `neutral-500`/`neutral-400` (secondary text color, [§3](03-design-tokens.md)), never colored for emphasis.
2. **Status icons** (success checkmark, warning triangle, error indicator) — colored using the exact semantic token they represent (`status-positive`, `status-warning`, `status-critical`, [§3](03-design-tokens.md)) — never a decorative color, and always paired with text, never carrying meaning alone (§9).
3. **Navigation/wayfinding icons** (Sidebar section icons) — outlined at rest, filled + `text.primary`/`accent` colored when the section is active — the one place filled icons and the primary accent color intersect, and it's a controlled, singular pattern, not a general rule.

No icon ever appears alone as the sole carrier of meaning for an action a user must understand correctly — every icon in this system is either paired with a text label, or reserved for a small, universally-understood set (search, close) where the meaning is genuinely unambiguous without one.

## Accessibility

Every icon used as an interactive control (an icon-only button) has an `aria-label` describing the action, not the icon ("Close" not "X icon") — reused directly from [M20's Button primitive contract](../frontend-architecture/05-component-architecture.md). Every icon used purely decoratively alongside a text label is `aria-hidden="true"`, so screen readers don't announce a redundant, unlabeled icon name. Icon color is never the sole means of conveying a status (Design Principle 3/§9) — every status icon's shape is also distinct (a checkmark is not the same silhouette as a warning triangle), so the signal survives for users who can't perceive color at all.
