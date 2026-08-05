# Milestone 21 — Enterprise Design System & Visual Foundation

**Date**: 2026-07-25
**Scope**: the permanent visual system — real tokens, typography, iconography, components, motion, accessibility — every future screen inherits from this. No React components, no application pages, no business logic, no changes to [M20](../frontend-architecture/README.md), [M20.5](../product-experience/README.md), or [M20.6](../career-intelligence/README.md).

## How this document set relates to what came before

M20 fixed token *structure* and deliberately deferred every real value (OQ-16). M20.5 fixed tone and trust. M20.6 fixed what the platform would know and how honestly. This milestone is where the visual system stops being a placeholder and becomes real — concrete colors, a committed typeface, a chosen icon library, fully specified components — while remaining strictly additive to everything already decided. Where a real value fills a gap M20 explicitly left open, that's stated; where a new component is introduced, it's checked against M20's existing set first so nothing is duplicated ([§7](07-component-library.md)'s own explicit A/B split).

## Index

| # | Document | Covers |
|---|---|---|
| 1 | [Design Philosophy](01-design-philosophy.md) | The seven visual traits and how each reduces cognitive load / builds trust |
| 2 | [Design Principles](02-design-principles.md) | 12 permanent visual rules |
| 3 | [Design Tokens](03-design-tokens.md) | Real color/spacing/radius/shadow/opacity/motion/breakpoint values |
| 4 | [Typography System](04-typography-system.md) | Inter + JetBrains Mono, role mapping, responsive scaling |
| 5 | [Grid System](05-grid-system.md) | Per-breakpoint columns, container rules, whitespace strategy |
| 6 | [Iconography](06-iconography.md) | Lucide, stroke width, filled/outlined rules |
| 7 | [Component Library](07-component-library.md) | Visual specs for M20's components + full contracts for new ones |
| 8 | [Motion System](08-motion-system.md) | Every animation pattern and the state it communicates |
| 9 | [Accessibility](09-accessibility.md) | WCAG AA contrast table, keyboard/focus/screen-reader specifics |
| 10 | [Responsive Strategy](10-responsive-strategy.md) | Desktop-first design priority, reconciled with M20's mobile-first CSS |
| 11 | [Mission Control Visual Language](11-mission-control-visual-language.md) | Timeline, Map, Execution Cards, Confidence, Recommendation Cards, Career Health, Decision Reports |
| 12 | [AI Visual Language](12-ai-visual-language.md) | Never magical, always explainable — the visual rules for every AI-originated element |
| 13 | [Design Decision Records](13-design-decision-records.md) | 8 DDRs covering every real value/choice this milestone commits to |
| 14 | [Risks, Future Expansion, Readiness](14-risks-and-future-expansion.md) | Design risks, scalability considerations, M22 readiness |

---

## Executive Summary

This milestone resolves the one deferred decision every prior blueprint milestone was built around not making: [M20 §11](../frontend-architecture/11-design-system-foundation.md) fixed token names and scale relationships but explicitly withheld real colors, a typeface, and an icon set until "a follow-up pass" (OQ-16). This is that pass. The system now has committed, justified real values across every category the milestone requested — an indigo-600 primary accent and Tailwind-derived neutral/semantic palette chosen over inventing unvetted hex codes ([§3](03-design-tokens.md), [DDR-002](13-design-decision-records.md)); Inter across every typographic role, resolving M20's two-family framing into one, better matching the milestone's own named reference platforms ([§4](04-typography-system.md), [DDR-001](13-design-decision-records.md)); Lucide as the single icon source ([§6](06-iconography.md)); and a fully specified component library that extends, and never duplicates, M20's existing contracts ([§7](07-component-library.md)).

The two highest-value decisions in this document set are the ones addressing where AI-driven and Mission-Control content could most easily go wrong visually. [§11](11-mission-control-visual-language.md) and [§12](12-ai-visual-language.md) establish that every confidence indicator is a single-hue intensity scale, never a red-to-green traffic light that would visually shame an honestly-low-confidence, low-evidence state ([DDR-006](13-design-decision-records.md)) — and that no AI-originated content ever receives a distinct "special" visual treatment (a glow, a badge, a gradient), because doing so would imply a category difference between "AI content" and "regular content" that this platform's own philosophy holds shouldn't exist ([DDR-007](13-design-decision-records.md)). Both decisions are the visual-design enforcement of rules [Product Experience](../product-experience/README.md) and [Career Intelligence](../career-intelligence/README.md) already established in words — this milestone is where those words become pixels.

One genuine tension was found and resolved explicitly rather than glossed over: this milestone's own request for a "Desktop First" responsive strategy sits alongside M20's already-committed "mobile-first" CSS methodology. [§10](10-responsive-strategy.md) and [DDR-005](13-design-decision-records.md) resolve this by separating *design priority* (desktop-first — where the richest, most-considered experience is designed first, appropriate for a data-dense operational tool) from *implementation methodology* (mobile-first CSS, unchanged from M20) — two different questions, not a contradiction, stated plainly so no future implementer has to guess which one wins.

## Readiness assessment

**Yes — the platform is prepared to begin Milestone 22 (frontend implementation).** This is the first of the four post-M20 blueprint milestones where the readiness conclusion is unqualified for the full 🟢 live surface: not just "the architecture is ready" (M20) or "this doesn't block anything" (M20.5, M20.6), but "every value needed to build a pixel-accurate component now exists." What remains — dark-mode visual validation, automated (not just calculated) accessibility verification, and connecting the Mission Control/AI visual language to real backend data once it exists — are integration and validation steps that happen *during* implementation, not prerequisites to *starting* it. Full reasoning in [§14](14-risks-and-future-expansion.md).
