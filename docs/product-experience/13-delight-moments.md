# 13. Delight Moments

## The principle: restraint is what makes celebration mean something

If every action gets a confetti burst, none of them do. Delight Moments are deliberately rare, reserved for genuine firsts and genuine milestones — each one backed by a real, first-time-observed state transition, never a generic "nice job" applied liberally. This is [Motivation System §6](06-motivation-system.md)'s Career Milestones mechanism, given its specific tonal treatment here.

## The moments, and their real trigger

| Moment | Real trigger | Intensity |
|---|---|---|
| First profile completed | `GET /profiles/me` crosses the completeness threshold for the first time (§5/§6) | Subtle |
| First campaign launched | First `POST /campaigns/:id/start` ever, for this user | Subtle-to-moderate |
| First application delivered | First `ApplicationLifecycleStatus.DELIVERED` transition | Subtle-to-moderate |
| First company reply | First `COMPANY_REPLIED` transition | Moderate |
| First interview | First `INTERVIEW_SCHEDULED` transition | Moderate-to-warm (§2's Interview stage) |
| Contract received | `CONTRACT_SIGNED` transition | The single largest acknowledgment in the product |

Intensity scales with real-world significance, not with technical novelty — a first profile save is a smaller life event than a signed contract, and the product's warmth should track that, not treat every "first" identically.

## What "professional, never childish" means concretely

**Yes**: a brief, warm sentence acknowledging the specific real event ("Your first application has been delivered — [Company] now has your details."), a subtle visual accent (a checkmark with slightly more presence than usual, a moment of color that isn't otherwise in the palette), timed once, not repeated on every subsequent visit to that screen.

**No**: confetti animations, sound effects, cartoon mascots, exclamation-point stacking ("Amazing!!! 🎉🎉🎉"), badges/trophies/achievement-unlocked framing, anything that would look at home in a mobile game rather than a career platform someone is trusting with something serious.

## The contract-received moment specifically

This is the product's single biggest deserved celebration — a real job offer, formally accepted, is a genuinely major life outcome, and under-celebrating it (treating it identically to a routine status update) would be a real emotional miss, not just a missed opportunity. The register still stays professional (per [§1](01-product-personality.md) — never childish, even here) but is allowed to be warmer and more explicit than anywhere else in the product: acknowledging the achievement directly, referencing the journey briefly if real data supports it (e.g. "from your first application to signed contract" only if that's a real, traceable span — see [§6's Achievement History](06-motivation-system.md)), and treating this as a genuine narrative close, not just another badge.

## Rules

1. **Once per user, per milestone.** These are firsts — a second signed contract is still worth acknowledging, but at the lower intensity a "success message" (§8) gets, not the first-time intensity.
2. **Never blocks the task at hand.** A celebration is a brief overlay/inline acknowledgment on the confirmation the user was already getting, never a separate modal the user has to dismiss before continuing (directly enforces [15-experience-principles.md](15-experience-principles.md)'s "never interrupt without value" — a celebration that gets in the way stops being delightful).
3. **Never manufactured for an event that isn't actually a first or a real milestone.** No milestone system invents intermediate arbitrary thresholds (§6's anti-manipulation rule applies here too — no "5 applications sent!" badge with no real significance behind the number 5 specifically).
4. **Respects `prefers-reduced-motion`** ([M20 §11](../frontend-architecture/11-design-system-foundation.md)) — the acknowledgment's *content* (the warm sentence) is never dependent on the *motion*; a user with reduced motion still gets the full acknowledgment, just without the animated flourish.
