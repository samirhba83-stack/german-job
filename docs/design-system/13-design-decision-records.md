# 13. Design Decision Records (DDRs)

Same format as [M20's ADRs](../frontend-architecture/12-architecture-decision-records.md), [Product Experience's UX-DRs](../product-experience/16-ux-decision-records.md), and [Career Intelligence's ADRs](../career-intelligence/12-architecture-decision-records.md): Context, Decision, Consequences, Alternatives Considered. This is the process every future token/component addition must go through, per [§10](10-responsive-strategy.md)'s closing rule.

---

### DDR-001: Single typeface family (Inter) instead of a two-family display/body split

**Context**: [M20 §11](../frontend-architecture/11-design-system-foundation.md) framed the typography system as two roles — a body face and "a touch more character" display face — but deferred the actual selection (OQ-16).

**Decision**: one family, Inter, across every role, differentiated by weight/size only ([§4](04-typography-system.md)).

**Consequences**: less visual distinctiveness between display and body text than a two-family system would give; in exchange, tighter consistency, one font to load/optimize, and a closer match to the milestone's own named reference platforms' actual patterns.

**Alternatives considered**: a distinct display serif or geometric sans for headings (rejected — would introduce a second brand signature this product doesn't need, and risks looking decorative rather than functional, contradicting [§1](01-design-philosophy.md)).

---

### DDR-002: Tailwind-derived palette (indigo primary, slate neutrals) instead of a custom hex palette

**Context**: [§3](03-design-tokens.md) needed real color values; inventing a fully custom palette risks unverified contrast characteristics.

**Decision**: build on Tailwind's professionally-vetted default scales.

**Consequences**: lower accessibility risk (§9's contrast table is grounded in well-tested values), faster implementation (no custom palette generation/testing pipeline needed), at the cost of a less bespoke-feeling brand color than a fully custom palette might achieve.

**Alternatives considered**: a custom-generated palette via a color-scale tool (rejected as unnecessary risk/effort for a milestone whose deliverable is architecture, not final brand identity — a future dedicated branding pass, if ever pursued, can still substitute a custom palette into the same token *structure* without touching any component).

---

### DDR-003: Lucide as the single icon library

**Context**: [§6](06-iconography.md) needed a concrete icon source; no icon library existed anywhere in the product before this milestone.

**Decision**: Lucide, exclusively, stroke-width 1.75px.

**Consequences**: consistent icon language platform-wide; if a needed icon is missing, custom additions must match Lucide's grid/stroke exactly, which is a real, ongoing discipline requirement, not a one-time cost.

**Alternatives considered**: Heroicons (Tailwind's own — a reasonable alternative, rejected only because Lucide's larger set better covers this platform's specific domain icon needs — documents, timelines, companies); a mixed-source approach (rejected outright — inconsistent stroke weights/grids across sources is a direct violation of [Design Principle 1](02-design-principles.md)).

---

### DDR-004: Restrained radius scale (8px default), not a heavily-rounded consumer-app style

**Context**: [§3](03-design-tokens.md) needed real radius values; corner rounding is one of the most visually loaded decisions in any design system (a large radius reads "friendly/consumer," a small one reads "precise/enterprise").

**Decision**: `radius-md` (8px) as the default component radius, scaling to `radius-xl` (16px) only for rare, large feature surfaces.

**Consequences**: a visually more restrained, enterprise-appropriate feel, consistent with [§1's](01-design-philosophy.md) "professional, premium" register — at some cost of the softer, more approachable feel a larger default radius (16–24px, common in consumer fintech/productivity apps) would give.

**Alternatives considered**: a 12px or 16px default (rejected as leaning too consumer-facing for an operational tool whose named references — Stripe, Linear, GitHub — all use comparably restrained radii).

---

### DDR-005: Desktop-first design priority, mobile-first CSS methodology unchanged

**Context**: this milestone explicitly requested a "Desktop First" responsive strategy; M20 had already committed to mobile-first CSS authoring.

**Decision**: treat these as answering different questions, per [§10](10-responsive-strategy.md) — design priority is desktop-first (richest experience designed first, smaller viewports are considered reductions), implementation stays mobile-first CSS (unchanged from M20).

**Consequences**: requires every future designer/implementer to understand this distinction rather than assume one term implies the other — a real, ongoing communication cost, mitigated by stating it explicitly here and in §10 rather than leaving it implicit.

**Alternatives considered**: reversing M20's mobile-first CSS commitment entirely (rejected — explicitly forbidden by this milestone's own "do not redesign previous architecture" constraint); ignoring this milestone's "Desktop First" framing in favor of M20's existing language (rejected — would leave the milestone's explicit request unaddressed).

---

### DDR-006: Confidence Indicator uses a single hue at varying intensity, never a red-to-green traffic-light gradient

**Context**: [§12](12-ai-visual-language.md) needed a color treatment for the four confidence bands; a traffic-light gradient (red=low, green=high) is the default instinct for most confidence/score visualizations.

**Decision**: all four bands render in `indigo-600` at increasing fill, never shifting hue.

**Consequences**: prevents the single most likely accidental violation of [Career Intelligence's "never overstate/undersell confidence"](../career-intelligence/11-ethical-intelligence-rules.md) rule — a red "Low confidence" segment would visually imply a problem or failure that a low-evidence-but-honest state isn't. Costs some at-a-glance scannability a color-coded system would have offered.

**Alternatives considered**: a traffic-light gradient (rejected for the reason above); a grayscale-intensity scale instead of `indigo-600` (a reasonable alternative, rejected only because it would make the Confidence Indicator visually disconnected from the rest of the system's interactive/informational color language).

---

### DDR-007: AI-originated content gets zero distinct visual treatment from ordinary content

**Context**: [§12](12-ai-visual-language.md) needed to decide whether recommendations/insights get a visually distinct "AI" styling (a glow, a badge, a gradient border) to signal their origin.

**Decision**: no distinct treatment whatsoever — a Recommendation Card looks exactly like any other Card in the system.

**Consequences**: the platform's intelligence features are visually humble by design, which directly serves [§1's](01-design-philosophy.md) "never magical, always explainable" mandate — at the cost of AI-driven features being less visually "showcased" than a product optimizing for hype might want.

**Alternatives considered**: a subtle "AI-generated" badge or icon on every such card (rejected — even a restrained badge implies a category distinction between "AI content" and "regular content" that this platform's own philosophy holds shouldn't exist: every claim here, AI-computed or not, is expected to be equally evidenced and equally trustworthy).

---

### DDR-008: New Part-B components ([§7](07-component-library.md)) get full M20-template contracts; existing Part-A components get visual specs only

**Context**: this milestone's "do not duplicate component definitions" constraint required a clear rule for handling the overlap between this milestone's requested component list and M20's existing one.

**Decision**: the split documented in [§7](07-component-library.md)'s own header — Part A (M20-existing) gets visual tokens only; Part B (genuinely new) gets full contracts using M20's exact template for consistency.

**Consequences**: a slightly more complex document structure (two tiers instead of one flat list) in exchange for an auditable, unambiguous answer to "was anything duplicated" — every Part A entry can be checked against M20 §5 directly.

**Alternatives considered**: giving every component (including M20's existing ones) a full contract "for completeness" (rejected — this is precisely what the milestone's constraint forbids, regardless of good intentions).
