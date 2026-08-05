# 8. Progressive Disclosure

## Real mechanisms available today

Three real, built components implement progressive disclosure, ready for the workspace pages that will need them:

- **Accordion** (`components/ui/accordion.tsx`, built in Milestone 22.2, matching [M21 §7](../design-system/07-component-library.md) Part B's contract exactly) — a real compound component (`Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent`) supporting both `single` (default — expanding one item collapses any other) and `multiple` variants, `aria-expanded`/`aria-controls` wired between trigger and content, a chevron that rotates on expand, and a CSS grid-based height transition (`grid-template-rows` 0fr→1fr) using the same `duration-base`/`ease-standard` tokens every other transition in the shell uses — not a new, bespoke animation. Not yet instantiated anywhere in this milestone's shell, since nothing built so far has secondary detail complex enough to need it; its first real use will naturally be a Decision Explanation block's "what else we considered" section, per [Product Experience §7](../product-experience/07-decision-explanation-framework.md) and [Design System §11](../design-system/11-mission-control-visual-language.md).
- **DropdownMenu** (`components/ui/dropdown-menu.tsx`) — used throughout this milestone's own shell (Profile Menu, Notification Area, Background Activity Center, Quick Actions, Theme Switcher) as the primary progressive-disclosure mechanism for the header: each icon shows a compact trigger, full detail only on demand. Milestone 22.2 fixed two real accessibility defects here — see [12-accessibility.md](12-accessibility.md).
- **TrustFeedbackCard** (`components/shell/trust-feedback-card.tsx`, Milestone 22.2) — a persistent, non-toast surface for "what's happening and why you can trust it," accepting the same shape `getMissionStatus()` already produces. See [09-trust-feedback.md](09-trust-feedback.md).

## How the shell itself already practices this

The Global Header is the clearest real example built in this milestone: five distinct concerns (search, quick actions, background activity, notifications, profile) sit behind five compact triggers rather than being laid out expanded — a genuinely dense set of capabilities compressed into a header that stays visually calm at rest, exactly the "powerful without feeling complicated" balance the milestone asks Mission Control to eventually achieve. The same discipline is applied here first, at the shell level, before Mission Control exists to apply it to.

## What's reserved

Multi-level progressive disclosure specific to a data-dense screen (e.g. a Career Health dimension's collapsed summary expanding into its full evidence, per [Career Intelligence §7](../career-intelligence/07-career-health-score.md)) isn't built in this milestone — it requires the real workspace page it would live inside, which this milestone's constraints reserve for later.
