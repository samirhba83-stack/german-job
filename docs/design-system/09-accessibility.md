# 9. Accessibility

## The floor: WCAG 2.1 AA, verified at the token level

[M20 §10](../frontend-architecture/10-ux-principles.md) already committed to WCAG 2.1 AA as a floor, not an aspiration. This document is where that commitment becomes checkable: every token pairing in [§3](03-design-tokens.md) is designed to pass AA, so a component built correctly from tokens is accessible by construction, not by a separate accessibility pass after the fact (Design Principle 7).

## Color contrast — the actual numbers

| Pairing | Ratio | Passes |
|---|---|---|
| `text.primary` (`neutral-900`) on `background.default` (`neutral-50`) | ~17:1 | AAA |
| `text.secondary` (`neutral-500`) on `background.default` | ~4.6:1 | AA (normal text) |
| `indigo-600` on white (Button primary text-on-fill, reversed) | ~6:1 | AA |
| `status-critical` (`red-600`) on white | ~5.9:1 | AA |
| `status-warning` (`amber-600`) on white | ~3.2:1 | AA for large text/UI components only — **this is why `§7`'s Alert/Badge specs always pair amber with an icon and never use it for small body text**, a deliberate mitigation for its more marginal contrast |
| Dark mode equivalents (`neutral-50` text on `neutral-950` background, semantic `-400` shades on dark surfaces) | Independently verified to the same AA floor, not assumed equivalent from the light-mode pairing | AA |

Any new token proposed in the future ([§13's Design Decision Record process](13-design-decision-records.md)) must state its contrast ratio against every surface it's intended to sit on before being accepted — this is now a standing requirement, not a one-time audit.

## Keyboard navigation

Every interactive element in [§7's component library](07-component-library.md) is operable by keyboard alone, restated from [M20 §10](../frontend-architecture/10-ux-principles.md) with the specific mechanics now fixed per component: Dropdown/Select/Tabs use arrow-key navigation within the widget, `Tab` moves between widgets (never trapped except inside an open Dialog/Drawer, which correctly traps focus per their §7 specs), `Enter`/`Space` activates buttons and toggles, `Escape` closes any transient surface (Dropdown, Dialog, Toast dismiss, Tooltip). No interactive element in this system is ever implemented as a non-focusable element with a click handler — enforced at the Primitive tier ([M20 §5](../frontend-architecture/05-component-architecture.md)), so no Feature component built on top of it can violate this by accident.

## Focus visibility

`border.focus` (`indigo-600`, [§3](03-design-tokens.md)) as a 2px outline, offset 2px from the element's edge, on every focusable element without exception — never suppressed for mouse users (a common anti-pattern this system explicitly forbids: `:focus` styling is never removed in favor of `:focus-visible`-only if that would leave keyboard users with a weaker signal than intended; both are styled identically here since this product's operators are frequently power users who tab through forms).

## Screen reader considerations

- Every icon-only control has an `aria-label` naming the action ([§6](06-iconography.md)).
- Every async loading region has `aria-busy="true"` while loading and an `aria-live="polite"` announcement when content resolves (Loading Skeleton, [§7](07-component-library.md)).
- Every chart ships with a text-equivalent data table ([§7](07-component-library.md)) — never chart-only data.
- Every status communicated by color is also communicated by icon shape and text label ([§6](06-iconography.md), Design Principle 3) — a screen reader user gets the text label regardless; a low-vision user gets the icon shape even without perceiving the color difference.
- Form errors are associated with their field via `aria-describedby`, restated from [M20 §5's Input contract](../frontend-architecture/05-component-architecture.md).

## Reduced motion support

Every animation defined in [§8](08-motion-system.md) has a named reduced-motion equivalent — an instant state change, never an animation "made slightly shorter." This is queried once, globally (`prefers-reduced-motion: reduce`), and every component respects it uniformly rather than each component implementing its own check.

## What this document adds beyond restating M20 §10

M20 §10 stated the *commitment*. This document is where the commitment gets its actual numbers (the contrast table above), its component-by-component keyboard mechanics, and its explicit focus-visibility policy (no `:focus-visible`-only downgrade) — the difference between "we will be accessible" and "here is exactly what accessible means for every component in this system."
