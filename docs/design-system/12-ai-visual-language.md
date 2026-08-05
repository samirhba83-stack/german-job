# 12. AI Visual Language

## The one sentence that governs this entire document

**AI should never appear magical. AI must always appear explainable.** Every visual pattern below exists to make evidence and reasoning legible at a glance — never to make the platform's intelligence *seem* more sophisticated than it is. This is the pixel-level enforcement of [Product Experience's AI Communication Style](../product-experience/08-ai-communication-style.md) and [Career Intelligence's Ethical Intelligence Rules](../career-intelligence/11-ethical-intelligence-rules.md), and the visual counterpart to that document's ban on "our AI has analyzed thousands of data points" copy: no sparkle icons, no gradient "AI glow" effects, no particle animations, no anthropomorphized avatar — none of the visual vocabulary that reads as "magic" in most 2020s AI product design.

## What "explainable" looks like, element by element

### Recommendations
Always rendered as a Recommendation Card ([§11](11-mission-control-visual-language.md)) with its Confidence Indicator and evidence summary **structurally attached, never optional or a separate click-through**. Visual weight: same as any other Card in the system — never a special "AI card" treatment (a distinct border glow, a gradient background) that would visually claim more authority than the content warrants. This is deliberate: an AI-originated recommendation looks exactly as calm and ordinary as a plain data fact, because it *is* one — a claim backed by real evidence, not a different category of content.

### Insights
Same treatment as Recommendations — the term is used interchangeably in copy per [Product Experience](../product-experience/08-ai-communication-style.md), so it gets identical visual treatment, not a distinct pattern that would imply a difference where none exists.

### Confidence
The Confidence Indicator ([§11](11-mission-control-visual-language.md)): a four-segment bar, filled to the achieved band, **always paired with the real number/percentage in Numbers typography** ([§4](04-typography-system.md)) directly beside it. Never a bare adjective ("High confidence") with no visual scale, and never a bare percentage with no band context — both together, always, so the claim is checkable at a glance whether the user reads numbers or scans shapes.

**Color mapping is deliberately restrained**: all four bands use the same `indigo-600` hue at increasing fill/opacity — never a red-to-green traffic-light gradient across the confidence scale. A traffic-light treatment would imply "Low confidence = bad/danger," which is false — low confidence is an honest, correct state when evidence is genuinely thin (per [Career Intelligence §6](../career-intelligence/06-learning-confidence-framework.md)), not a warning. Reserving `status-warning`/`status-critical` tokens for genuine problems (a failed action, a stale pattern) keeps that distinction intact.

### Evidence
Rendered as real, specific content — a list of the actual data points behind a claim (real dates, real counts, real field values), never a vague "based on your activity" placeholder. Typographically: `text-body-sm`, always in a visually distinct block beneath the headline claim (a subtle `background.subtle` fill or a left border in `neutral-300`) so evidence is always locatable at the same relative position, every time, everywhere it appears ([Design Principle 5](02-design-principles.md)).

### Warnings
Use the Alert component's `warning` variant ([§7](07-component-library.md)) exactly — a real warning (a stale pattern, a campaign issue) gets the same visual treatment as any other platform warning, never a distinct "AI warning" style. This reinforces that an AI-surfaced warning is exactly as real and actionable as a system warning, not a lesser or more speculative category.

### Decision explanations
The full Decision Report layout ([§11](11-mission-control-visual-language.md)) — headline, confidence, evidence, alternatives-considered, all structurally present, none collapsible-away entirely (the Accordion in Recommendation Cards collapses *depth*, never the presence of the section itself — a user can always see that alternatives exist and get a one-line reason, even before expanding for full detail).

## What this visual language explicitly forbids

- **Gradient "AI" treatments** (a purple-to-blue glowing border, a shimmering background) on any recommendation, insight, or confidence element — the exact "AI slop" visual cliché this document set deliberately avoids, consistent with [§1's](01-design-philosophy.md) rejection of decorative gradients generally.
- **A loading state that implies "thinking"** (an animated brain icon, a "typing" indicator, a multi-stage "analyzing..." sequence with no real stages behind it) — an AI-originated result loads exactly like any other async content: a Loading Skeleton ([§7](07-component-library.md)), nothing more theatrical, because there's no real multi-stage process to visualize honestly at the point the user is looking at a loading state.
- **A confidence score with no visible evidence** — structurally impossible in this system, since the Confidence Indicator and evidence block are defined as one inseparable unit, never two components that could be assembled without each other by a future implementer in a hurry.
- **An icon or color implying certainty the underlying score doesn't support** — no checkmark on a Moderate-confidence recommendation, no "verified" badge on anything that hasn't reached [Career Intelligence's High/Very High bands](../career-intelligence/06-learning-confidence-framework.md).

## The test for any future AI-surfacing component

Before adding any new visual element to represent an AI-originated claim: **would a user who fully understood how this number was computed feel that the visual treatment matches its actual certainty?** If the visual treatment reads as more confident, more magical, or more authoritative than the real computation behind it, it fails — regardless of how good it looks. This is the visual-design mirror of [Product Experience's copywriting checklist](../product-experience/14-copywriting-guidelines.md) question, "would this sentence still be true if the user could see the raw backend data behind it?" — applied to pixels instead of words.
