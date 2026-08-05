# 10. Responsive Strategy

## Reconciling "Desktop First" with M20's mobile-first commitment — these answer different questions

This milestone asks for a Desktop-First responsive strategy. [M20 §10](../frontend-architecture/10-ux-principles.md) already committed to "mobile-first breakpoints." Both stand, because they answer different questions, and stating that explicitly here prevents a future implementer from reading one as contradicting the other:

- **Mobile-first is a CSS authoring methodology** (M20, unchanged) — base styles target the smallest viewport, complexity is added via `min-width` media queries layering upward. This is a technical implementation detail about how the stylesheet is structured, chosen to avoid fighting Tailwind's own default direction.
- **Desktop-first is a design-priority statement** (this milestone) — for an operational, data-dense enterprise tool (Mission Control, Data Tables, multi-column Dashboards), the richest, most complete experience is designed for desktop first, and every smaller viewport is a considered *reduction* of that experience, not an independently-designed alternative. This matches how this product is actually used — a job-search campaign is far more likely to be actively managed from a laptop/desktop than composed from a phone, even though mobile access must remain fully functional.

**In practice**: a new screen's design process starts by solving the Laptop/Desktop layout ([§5's](05-grid-system.md) full 12-column treatment) first, then defines what's removed/stacked/collapsed at each smaller breakpoint — while the resulting CSS is still authored mobile-first per M20. No contradiction; different layers of the same decision.

## Per-device-category behavior

| Category | Breakpoint range ([§3](03-design-tokens.md)) | Design treatment |
|---|---|---|
| **Desktop** | `xl`–`2xl` (1280–1535px) | The primary, fully-featured layout — full Sidebar, full Data Table columns, multi-widget Dashboard grids ([§5](05-grid-system.md)) |
| **Laptop** | `lg`–`xl` (1024–1279px) | Same layout as Desktop, tighter gutters, 3-up (not 4-up) card grids |
| **Tablet** | `sm`–`lg` (640–1023px) | Sidebar becomes an off-canvas Drawer ([M20 §4](../frontend-architecture/04-dashboard-architecture.md)), Data Tables begin degrading to stacked cards at the lower end of this range ([M20 §10](../frontend-architecture/10-ux-principles.md)) |
| **Mobile** | `< sm` (640px) | Single-column throughout, Data Tables fully stacked-card, `text-display`/`text-heading-lg` use their reduced sizes ([§4](04-typography-system.md)) |
| **Large screens** | `2xl`–`3xl` (1536–1919px) | Same layout as Desktop, additional whitespace/padding, never additional columns ([§5](05-grid-system.md)) |
| **Ultra-wide monitors** | `≥ 3xl` (1920px+) | Content capped at 1440px and centered ([§5](05-grid-system.md)) — a deliberate rejection of stretching a data-dense layout across a 32"+ ultra-wide display, which would produce unreadable line lengths and disorienting column widths |

## Component consistency requirement

Every component in [§7](07-component-library.md) must render correctly at every breakpoint above using only the responsive rules already defined in this document set (§4's typography scaling, §5's grid collapse, this document's device-category table) — a component is never given a bespoke, undocumented responsive behavior found only in its own implementation. If a genuinely new responsive pattern is needed, it's proposed as a Design Decision Record ([§13](13-design-decision-records.md)) and added to this shared system, not implemented locally and left undocumented.
