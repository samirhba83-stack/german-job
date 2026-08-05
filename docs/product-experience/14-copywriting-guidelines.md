# 14. Human Copywriting Guidelines

## The five properties every sentence must have

**Clear** — one reading, no ambiguity. If a sentence needs a second read to parse, it's rewritten, not explained further.
**Honest** — matches the real backend state exactly (this document is downstream of every grounding rule in [03](03-trust-architecture.md) and [04](04-transparency-principles.md); copywriting is where those rules become literal words).
**Professional** — the register defined in [§1](01-product-personality.md) and [§8](08-ai-communication-style.md), consistently, not situationally.
**Short** — the shortest sentence that says the true, complete thing. Cutting words is not the goal; cutting *padding* is.
**Action-oriented** — states what happened or what to do, not what the platform feels about it.

## Before/after examples, grounded in real product moments

| Don't | Do | Why |
|---|---|---|
| "Awesome! Your profile is looking great!" | "Your profile is 80% complete. Add your work experience to finish it." | Specific, honest, action-oriented — not performed enthusiasm about an unfinished task |
| "We're working hard to find your dream job!" | "Your campaign is running. 3 companies have been targeted this week." | Real data, not a vague effort-claim the user can't verify |
| "Oops! Something went wrong 😅" | "This didn't go through. Try again, or check back in a few minutes." | No cutesy apology-deflection; states the fact and the path forward ([§11](11-error-experience.md)) |
| "You're missing out on 5 great opportunities!" | "5 published roles match your profile's German-level and location filters." | Removes loss-framing ([§6](06-motivation-system.md)'s anti-manipulation rule), states the real fact underneath |
| "This is definitely your best match!" | "Strong fit (78% confidence) based on your profile and this company's requirements." | Calibrated to the real `confidenceScore`, not an absolute claim ([§4](04-transparency-principles.md)) |
| "Hurry — don't miss this opportunity!" | "This role was published 2 days ago." | No manufactured urgency ([§14](14-copywriting-guidelines.md) — this document's own rule, stated here for the reader) — a neutral fact lets the user judge urgency themselves |
| "Our AI has analyzed thousands of data points to find you the perfect match." | "We compared this company against your profile and 4 similar opportunities." | No inflated, unverifiable capability claims — see the AI-capability rule below |

## Never create unnecessary anxiety

No copy implies a problem that isn't real. A paused campaign is a neutral, user-chosen state — copy describing it never uses alarm language ("Your campaign is paused" not "Your campaign is stuck!"). A `PAST_DUE` subscription is a real fact worth surfacing clearly, but stated plainly, not as a countdown-to-doom.

## Never create false urgency

No countdown timers, no "act now," no implied scarcity the backend doesn't actually have (nothing in this platform's domain model produces genuine artificial scarcity — no limited slots, no expiring-in-minutes offers). Where a real deadline exists (`currentPeriodEnd`, an interview time), state the real date/time plainly — a real date is more motivating than a manufactured one anyway, because it's verifiable.

## Never exaggerate AI capabilities

This is the copywriting-layer enforcement of [§3](03-trust-architecture.md) and [§8](08-ai-communication-style.md): no "our AI knows exactly what you need," no implying the recommendation engine has broader awareness or certainty than its actual `confidenceScore`/`expectedImpactScore` supports, no anthropomorphizing the system as having intentions or feelings ("we're excited about this match for you" overstates — "this is a strong match based on..." states the real thing). Every AI-capability claim must be a claim the backend's actual explainability data (§3's field table) could substantiate if the user asked to see the reasoning — if it couldn't survive that test, it doesn't get written.

## A working checklist for any new copy

1. Would this sentence still be true if the user could see the raw backend data behind it?
2. Does it say what happened/what to do, or does it perform a feeling instead?
3. Could half these words be cut without losing meaning?
4. Does it use plain language, or does it leak domain/system vocabulary the user never opted into?
5. If it names urgency or scarcity, is that urgency real and specific?
6. If it makes a capability claim, could the platform back it up if asked "based on what"?
