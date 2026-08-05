# 4. Typography System

## The typeface decision (resolving M20's OQ-16)

**Inter** (variable font, weights 400/500/600/700) for every UI role. **JetBrains Mono** (weight 400/500) for the monospace role.

**Rationale**: [M20 §11](../frontend-architecture/11-design-system-foundation.md) deliberately left this open, framed as "one face for UI/body... one for display/headings, a touch more character." Having now surveyed the milestone's own named reference platforms, the more accurate pattern across Linear, Vercel, and Figma is a **single family across every role**, differentiated by weight and size, not two separate families — this is the resolution chosen here, and it's a refinement of M20's framing, not a contradiction of anything M20 fixed (M20 fixed sizes/line-heights/role names, never the number of font families). Inter specifically: exceptional legibility at small sizes (this product's `text-body-sm`/`text-caption` tokens are genuinely small, 12–13px), a huge weight range covering both restrained body text and confident headings without needing a second family, complete German-language glyph coverage (ß, umlauts — non-negotiable for this market), a large `tnum` (tabular figures) feature set critical for [§7's](07-component-library.md) tables and statistic cards, free/open licensing, and direct precedent across this milestone's named reference set. JetBrains Mono for `text-mono`: purpose-built for dense identifier/numeric legibility, distinguishes ambiguous characters (`0`/`O`, `1`/`l`) — critical since `text-mono` is reserved specifically for correlation/trace ids (per [M20](../frontend-architecture/11-design-system-foundation.md)), where that ambiguity would be a real usability problem, not just an aesthetic one.

## Role mapping — filling M20's seven size tokens, adding weight/treatment on top

M20 fixed exactly seven size/line-height pairs. This milestone's nine requested roles map onto those seven via **weight and treatment**, not new sizes — reusing the existing scale rather than fragmenting it (Design Principle 1, consistency):

| Requested role | Maps to M20 token | Weight | Treatment |
|---|---|---|---|
| Display | `text-display` (32px/1.2) | 700 | — |
| Heading | `text-heading-lg` (24px/1.3) | 600 | — |
| Subheading | `text-heading-md` (18px/1.4) | 600 | — |
| Body | `text-body` (15px/1.5) | 400 | — |
| Caption | `text-caption` (12px/1.4) | 400 | `text.secondary` color by default |
| Labels | `text-caption` (12px/1.4) | 600 | Uppercase, `letter-spacing: 0.04em` — distinguishes a form/field label from a caption at the same size purely through weight+treatment |
| Numbers | Whichever size token the context calls for (`text-body`, `text-heading-lg`, etc.) | 600 typically | `font-variant-numeric: tabular-nums` always — critical for any column of aligned figures (goal progress, statistic cards, §7) |
| Tables | `text-body-sm` (13px/1.5) | 400 (body cells), 600 (headers) | `tabular-nums` on any numeric column; table headers additionally get the Labels treatment (uppercase, tracked) |
| Monospace | `text-mono` (13px/1.5) | 400 | JetBrains Mono family, `tabular-nums` |

## Reading hierarchy

One rule governs every screen: **exactly one `text-display` per page** (the page's own title — a Campaign's name, "Dashboard"), **`text-heading-lg` for major sections within that page**, **`text-heading-md` for card/dialog-level titles nested within a section**, **`text-body` for everything a user reads as content**, **`text-body-sm`/`text-caption` for everything supporting that content** (timestamps, helper text, metadata). Skipping a level (e.g. a `text-heading-md` directly under a `text-display` with no `text-heading-lg` section in between) is permitted when there's genuinely only one section on the page — inventing an intermediate heading purely to fill the hierarchy is not.

## Responsive typography rules (new — M20 didn't specify scaling behavior)

Sizes do not scale continuously with viewport width (avoids the unpredictable, hard-to-test "fluid type" pattern) — instead, exactly two fixed scales, switched at the `md` breakpoint (768px, per [§3](03-design-tokens.md)):

| Token | Below `md` (mobile) | `md` and above |
|---|---|---|
| `text-display` | 26px / 1.25 | 32px / 1.2 (M20's original value) |
| `text-heading-lg` | 20px / 1.3 | 24px / 1.3 |
| `text-heading-md` | 17px / 1.4 | 18px / 1.4 |
| `text-body`, `text-body-sm`, `text-caption`, `text-mono` | Unchanged at every breakpoint | Unchanged |

Only the three largest roles scale down on mobile — body-level text stays fixed across every breakpoint (per [M20's own reasoning](../frontend-architecture/11-design-system-foundation.md): `text-body` was already chosen dense/small deliberately for a data-heavy product, so it has no room to shrink further without harming legibility, and no need to grow on desktop since generous line-length, not larger type, is what desktop space should buy — reused directly in [§5's](05-grid-system.md) max-width reasoning).
