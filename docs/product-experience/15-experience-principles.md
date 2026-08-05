# 15. Experience Principles

Eighteen permanent rules. Every screen, message, animation, and interaction this product ever ships should be checkable against this list. Where a principle was established in more depth elsewhere in this document set, that's linked — this page is the compressed, memorable form, not a replacement for the reasoning behind each one.

1. **Explain every important action.** No consequential thing the platform does happens silently — see [Decision Explanation Framework](07-decision-explanation-framework.md).
2. **Show evidence before conclusions.** A recommendation's reasoning sits adjacent to its headline, never one click deeper — see [Trust Architecture](03-trust-architecture.md).
3. **Never fake activity.** No progress, no "live" indicator, no loading animation implies work that isn't actually happening — see [Loading Experience](12-loading-experience.md).
4. **Every recommendation needs evidence.** A suggestion with no `reasonCode`/`explanation` behind it doesn't ship — see [§7](07-decision-explanation-framework.md).
5. **Transparency builds trust; hiding anything erodes it faster than any single mistake would.** See [Transparency Principles](04-transparency-principles.md).
6. **State uncertainty as uncertainty.** A moderate confidence score gets moderate language, never confident language — see [§4](04-transparency-principles.md).
7. **Respect user attention.** No interruption, notification, or celebration exists to serve an engagement metric instead of the user — see [Motivation System](06-motivation-system.md), [Notification Strategy](09-notification-strategy.md).
8. **Never interrupt without value.** Only genuine Action-Required/Interview-tier events justify breaking a user's flow — see [§9](09-notification-strategy.md).
9. **Celebrate meaningful progress, rarely and specifically.** Restraint is what makes a celebration mean something — see [Delight Moments](13-delight-moments.md).
10. **Prefer clarity over complexity.** The shortest true sentence beats the more sophisticated-sounding one — see [Copywriting Guidelines](14-copywriting-guidelines.md).
11. **Consistency beats novelty.** One voice, one error pattern, one empty-state template, applied everywhere — never a bespoke treatment per screen just because it's new.
12. **Name every limitation plainly.** A dormant feature says "not connected yet," never disguises itself as broken or as loading forever — see [§4](04-transparency-principles.md).
13. **A retry offered must actually be capable of succeeding.** Never offer a retry the platform already knows will deterministically fail (e.g. `NullEmailProvider`) — see [Error Experience](11-error-experience.md).
14. **Waiting deserves a narrative, not a void.** Reframe silence into real, funnel-shaped progress wherever real data supports it — see [Progress Psychology](05-progress-psychology.md).
15. **No manufactured urgency, ever.** Real deadlines are stated as real dates; nothing else is dressed up as urgent — see [§14](14-copywriting-guidelines.md).
16. **No dark patterns.** No pre-checked defaults, no confirmshaming, no loss-framing, no streaks that punish rest — see [§6](06-motivation-system.md).
17. **The platform assists; it never overstates what it's doing on the user's behalf.** "Delegation" language is only used for what's actually automated today, not what's architecturally planned — see [Emotional Journey](02-emotional-journey.md)'s Execution stage.
18. **Every claim must survive the question "based on what?"** If a sentence can't point to a real field, event, or number behind it, it doesn't ship — the single test that every other principle on this list ultimately reduces to.
