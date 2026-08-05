# 5. Grid System

## What's already fixed, what this adds

[M20 §11](../frontend-architecture/11-design-system-foundation.md) fixed: 12 columns, `space-4` gutters below `md`/`space-6` at and above, 1440px max content width. This document adds the per-breakpoint column behavior M20 didn't specify, plus container and whitespace rules.

## Per-breakpoint grid behavior

| Breakpoint | Width | Active columns | Typical layout |
|---|---|---|---|
| Mobile | < 640px (`sm`) | 4 of 12 (others collapse) | Single column, full-width cards/forms |
| Tablet | 640–1023px (`sm`–`lg`) | 8 of 12 | Two-column forms, 2-up card grids |
| Laptop | 1024–1279px (`lg`–`xl`) | 12 (full) | Sidebar + 12-col content area, 3-up card grids |
| Desktop | 1280–1535px (`xl`–`2xl`) | 12 (full) | Full dashboard layouts, 4-up card grids |
| Large screens | 1536–1919px (`2xl`–`3xl`, [§3](03-design-tokens.md)) | 12, wider gutters | Same layout as Desktop, extra breathing room, not extra columns |
| Ultra-wide | ≥ 1920px (`3xl`) | 12, capped at 1440px, centered | Content never stretches full-width — side padding absorbs the extra space |

The column count never exceeds 12 at any breakpoint — "more columns" past Laptop was deliberately rejected; extra space at wider viewports buys **more breathing room and better line-length**, not more simultaneous columns of content, consistent with [§1's](01-design-philosophy.md) "elegant through proportion" principle and [§4's](04-typography-system.md) reasoning for why `text-body` doesn't grow on desktop either.

## Maximum width and container rules

- **1440px max content width** (M20, unchanged) — applies to the primary content region inside [M20's app shell](../frontend-architecture/04-dashboard-architecture.md), not to the shell itself (Sidebar/Top Navigation span full viewport width; only the scrollable content area is width-capped).
- **Full-bleed exceptions**: data-dense screens with genuinely wide tabular content (a Timeline with many columns, [§7](07-component-library.md)'s Data Grid) may exceed 1440px up to the viewport width, with `overflow-x: auto` scoped to that specific component — this mirrors [M20's own rule](../frontend-architecture/10-ux-principles.md) that wide content scrolls within its own container, never stretching the page.
- **Container padding**: `space-4` (16px) on mobile, `space-6` (24px) on tablet/laptop, `space-8` (32px) at `2xl` and above — padding grows with viewport specifically to prevent content from touching the viewport edge on very wide monitors, not to change the content's own width.

## Whitespace strategy

Whitespace is allocated top-down, largest-to-smallest, matching [M20's spacing scale](../frontend-architecture/11-design-system-foundation.md) exactly: `space-16` (64px) between major page regions, `space-8` (32px) between sections within a region, `space-6` (24px) between cards/components within a section, `space-4` (16px) inside a card/component, `space-2`/`space-1` for the tightest internal groupings (icon-to-label). This is a strict nesting rule, not a suggestion — a component's internal spacing should always read as visibly tighter than the spacing separating it from its siblings, which is what lets a user's eye parse grouping without any border or background-color boxing being necessary (directly reduces the "boxes and borders" cognitive load [§1](01-design-philosophy.md) already commits to minimizing).
